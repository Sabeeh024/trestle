import { commentSchema, createTaskSchema, updateTaskSchema } from "@trestle/api-client/schemas";
import type { Comment, Task, TaskDetail, TaskListParams } from "@trestle/api-client/types";
import { and, asc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";

import { canWrite, requireAuth, toSummary, type Deps, type Env, type Principal } from "../context";
import { schema, type Db } from "../db";
import { badRequest, forbidden, ilike, iso, notFound, oneOf, pageParams, parseJson, parseTaskId, taskKey, type Page } from "../lib/http";
import { findProject } from "./projects";

const { tasks, projects, users, comments } = schema;

const taskColumns = {
  id: tasks.id,
  projectId: tasks.projectId,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  updatedAt: tasks.updatedAt,
  assigneeId: users.id,
  assigneeName: users.name,
};

type TaskRow = {
  id: number;
  projectId: string;
  title: string;
  description: string;
  status: Task["status"];
  priority: Task["priority"];
  dueDate: string | null;
  updatedAt: Date;
  assigneeId: string | null;
  assigneeName: string | null;
};

export const toTask = (r: TaskRow): Task => ({
  id: taskKey(r.id),
  projectId: r.projectId,
  title: r.title,
  description: r.description,
  status: r.status,
  priority: r.priority,
  assignee: r.assigneeId ? toSummary({ id: r.assigneeId, name: r.assigneeName! }) : null,
  dueDate: r.dueDate,
  updatedAt: iso(r.updatedAt),
});

/** Tasks in the caller's organization (tasks belong to an organization through their project). */
export async function listTasks(
  db: Db,
  me: Principal,
  filters: Omit<TaskListParams, "page" | "pageSize" | "assignee"> & { assignee?: string },
  { limit, offset, page, pageSize }: Page,
) {
  const assigneeId = filters.assignee === "me" ? me.id : filters.assignee;
  const q = filters.q?.trim();
  const taskNumber = q ? parseTaskId(q) : undefined;

  const where = and(
    eq(projects.orgId, me.orgId),
    filters.projectId ? eq(tasks.projectId, filters.projectId) : undefined,
    // A malformed id is not an error for a filter, it just matches nothing.
    assigneeId ? (isUuid(assigneeId) ? eq(tasks.assigneeId, assigneeId) : sql`false`) : undefined,
    filters.status ? eq(tasks.status, filters.status) : undefined,
    filters.priority ? eq(tasks.priority, filters.priority) : undefined,
    q ? (taskNumber !== undefined ? sql`(${ilike(tasks.title, q)} or ${tasks.id} = ${taskNumber})` : ilike(tasks.title, q)) : undefined,
  );

  // One query: the page of rows, the assignee joined in, and the total from a window count.
  const rows = await db
    .select({ ...taskColumns, total: sql<number>`count(*) over()`.mapWith(Number) })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(where)
    .orderBy(sql`${tasks.dueDate} asc nulls last`, asc(tasks.id))
    .limit(limit)
    .offset(offset);

  let total = rows[0]?.total ?? 0;
  // A page past the end has no rows to carry the window count.
  if (rows.length === 0 && offset > 0) {
    const [row] = await db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(where);
    total = row?.total ?? 0;
  }
  return { data: rows.map(toTask), meta: { page, pageSize, total } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

async function loadComments(db: Db, taskId: number): Promise<Comment[]> {
  const rows = await db
    .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, authorId: users.id, authorName: users.name })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.taskId, taskId))
    .orderBy(asc(comments.createdAt), asc(comments.id));
  return rows.map((r) => ({
    id: r.id,
    author: r.authorId ? toSummary({ id: r.authorId, name: r.authorName! }) : { id: "", name: "Deleted user", initials: "?" },
    body: r.body,
    createdAt: iso(r.createdAt),
  }));
}

async function loadTask(db: Db, orgId: string, id: number): Promise<TaskRow | undefined> {
  const [row] = await db
    .select(taskColumns)
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(eq(tasks.id, id), eq(projects.orgId, orgId)));
  return row;
}

async function detail(db: Db, row: TaskRow): Promise<TaskDetail> {
  return { ...toTask(row), comments: await loadComments(db, row.id) };
}

const touchProject = (db: Db, projectId: string) =>
  db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));

async function assigneeInOrg(db: Db, orgId: string, userId: string) {
  if (!isUuid(userId)) return false;
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId)));
  return Boolean(row);
}

export function taskRoutes(deps: Deps) {
  const { db } = deps;
  const app = new Hono<Env>();
  app.use("*", requireAuth(deps));

  app.get("/", async (c) => {
    const { projectId, assignee, q } = c.req.query();
    const status = oneOf(c.req.query("status"), schema.taskStatus.enumValues);
    const priority = oneOf(c.req.query("priority"), schema.taskPriority.enumValues);
    return c.json(await listTasks(db, c.get("me"), { projectId, assignee, status, priority, q }, pageParams(c)));
  });

  app.post("/", async (c) => {
    const me = c.get("me");
    if (!canWrite(me)) return forbidden(c);
    const parsed = await parseJson(c, createTaskSchema);
    if (!parsed.ok) return parsed.response;
    const { title, projectId, description, priority, status, dueDate } = parsed.data;
    const assigneeId = parsed.data.assigneeId ?? null;

    if (!(await findProject(db, me.orgId, projectId))) return badRequest(c, "projectId does not match a project");
    if (assigneeId && !(await assigneeInOrg(db, me.orgId, assigneeId))) return badRequest(c, "assigneeId does not match a user");

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(tasks)
        .values({ projectId, title, description: description ?? "", status: status ?? "todo", priority: priority ?? "medium", assigneeId, dueDate: dueDate || null })
        .returning({ id: tasks.id });
      await touchProject(tx, projectId);
      return row!.id;
    });
    return c.json({ data: await detail(db, (await loadTask(db, me.orgId, id))!) }, 201);
  });

  app.get("/:id", async (c) => {
    const id = parseTaskId(c.req.param("id"));
    const row = id === undefined ? undefined : await loadTask(db, c.get("me").orgId, id);
    return row ? c.json({ data: await detail(db, row) }) : notFound(c, "Task");
  });

  app.patch("/:id", async (c) => {
    const me = c.get("me");
    if (!canWrite(me)) return forbidden(c);
    const id = parseTaskId(c.req.param("id"));
    const existing = id === undefined ? undefined : await loadTask(db, me.orgId, id);
    if (!existing) return notFound(c, "Task");

    const parsed = await parseJson(c, updateTaskSchema);
    if (!parsed.ok) return parsed.response;
    const { title, description, status, priority, assigneeId, dueDate } = parsed.data;
    if (assigneeId && !(await assigneeInOrg(db, me.orgId, assigneeId))) return badRequest(c, "assigneeId does not match a user");

    const patch: Partial<typeof tasks.$inferInsert> = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (status !== undefined) patch.status = status;
    if (priority !== undefined) patch.priority = priority;
    if (assigneeId !== undefined) patch.assigneeId = assigneeId;
    if (dueDate !== undefined) patch.dueDate = dueDate || null;

    await db.transaction(async (tx) => {
      await tx.update(tasks).set(patch).where(eq(tasks.id, existing.id));
      await touchProject(tx, existing.projectId);
    });
    return c.json({ data: await detail(db, (await loadTask(db, me.orgId, existing.id))!) });
  });

  app.delete("/:id", async (c) => {
    const me = c.get("me");
    if (!canWrite(me)) return forbidden(c);
    const id = parseTaskId(c.req.param("id"));
    const existing = id === undefined ? undefined : await loadTask(db, me.orgId, id);
    if (!existing) return notFound(c, "Task");

    await db.transaction(async (tx) => {
      await tx.delete(tasks).where(eq(tasks.id, existing.id));
      await touchProject(tx, existing.projectId);
    });
    return c.body(null, 204);
  });

  app.post("/:id/comments", async (c) => {
    const me = c.get("me");
    if (!canWrite(me)) return forbidden(c);
    const id = parseTaskId(c.req.param("id"));
    const existing = id === undefined ? undefined : await loadTask(db, me.orgId, id);
    if (!existing) return notFound(c, "Task");

    const parsed = await parseJson(c, commentSchema);
    if (!parsed.ok) return parsed.response;

    const [row] = await db.insert(comments).values({ taskId: existing.id, authorId: me.id, body: parsed.data.body }).returning();
    const comment: Comment = {
      id: row!.id,
      author: toSummary({ id: me.id, name: me.name }),
      body: row!.body,
      createdAt: iso(row!.createdAt),
    };
    return c.json({ data: comment }, 201);
  });

  return app;
}
