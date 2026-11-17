import { commentSchema, createTaskSchema, updateTaskSchema } from "@trestle/api-client/schemas";
import type { Comment, Task, TaskDetail, TaskListParams } from "@trestle/api-client/types";
import { and, asc, eq, sql } from "drizzle-orm";

import { canWrite, toSummary, type Principal } from "../../context";
import { schema, type Db } from "../../db";
import { ilike, isUuid, iso, pageFrom, parseTaskId, taskKey, type Page } from "../../lib/http";
import type { GqlContext } from "../context";
import { badRequest, forbidden, notFound } from "../errors";
import { parseInput } from "../input";
import { findProject } from "./projects";

const { tasks, projects, users, comments } = schema;

type Input = { input: unknown };

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

/** The caller's task, or a not-found: a malformed key and a task in another organization look the same. */
async function ownTask(ctx: GqlContext, key: string) {
  const me = await ctx.me();
  const id = parseTaskId(key);
  const row = id === undefined ? undefined : await loadTask(ctx.deps.db, me.orgId, id);
  if (!row) throw notFound("Task");
  return { me, row };
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

export const taskQueries = {
  tasks: async (
    args: { page?: number | null; pageSize?: number | null; projectId?: string | null; assignee?: string | null; status?: Task["status"] | null; priority?: Task["priority"] | null; q?: string | null },
    ctx: GqlContext,
  ) => {
    const { page, pageSize, projectId, assignee, status, priority, q } = args;
    return listTasks(
      ctx.deps.db,
      await ctx.me(),
      { projectId: projectId ?? undefined, assignee: assignee ?? undefined, status: status ?? undefined, priority: priority ?? undefined, q: q ?? undefined },
      pageFrom({ page, pageSize }),
    );
  },

  task: async ({ id }: { id: string }, ctx: GqlContext) => {
    const { row } = await ownTask(ctx, id);
    return detail(ctx.deps.db, row);
  },
};

export const taskMutations = {
  createTask: async ({ input }: Input, ctx: GqlContext) => {
    const { db } = ctx.deps;
    const me = await ctx.me();
    if (!canWrite(me)) throw forbidden();
    const parsed = parseInput(createTaskSchema, input);
    const { title, projectId, description, priority, status, dueDate } = parsed;
    const assigneeId = parsed.assigneeId ?? null;

    if (!(await findProject(db, me.orgId, projectId))) throw badRequest("projectId does not match a project");
    if (assigneeId && !(await assigneeInOrg(db, me.orgId, assigneeId))) throw badRequest("assigneeId does not match a user");

    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(tasks)
        .values({ projectId, title, description: description ?? "", status: status ?? "todo", priority: priority ?? "medium", assigneeId, dueDate: dueDate || null })
        .returning({ id: tasks.id });
      await touchProject(tx, projectId);
      return row!.id;
    });
    return detail(db, (await loadTask(db, me.orgId, id))!);
  },

  updateTask: async ({ id: key, input }: { id: string } & Input, ctx: GqlContext) => {
    const { db } = ctx.deps;
    const me = await ctx.me();
    if (!canWrite(me)) throw forbidden();
    const { row: existing } = await ownTask(ctx, key);

    const { title, description, status, priority, assigneeId, dueDate } = parseInput(updateTaskSchema, input);
    if (assigneeId && !(await assigneeInOrg(db, me.orgId, assigneeId))) throw badRequest("assigneeId does not match a user");

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
    return detail(db, (await loadTask(db, me.orgId, existing.id))!);
  },

  deleteTask: async ({ id: key }: { id: string }, ctx: GqlContext) => {
    const { db } = ctx.deps;
    const me = await ctx.me();
    if (!canWrite(me)) throw forbidden();
    const { row: existing } = await ownTask(ctx, key);

    await db.transaction(async (tx) => {
      await tx.delete(tasks).where(eq(tasks.id, existing.id));
      await touchProject(tx, existing.projectId);
    });
    return true;
  },

  addComment: async ({ taskId, body }: { taskId: string; body?: string | null }, ctx: GqlContext) => {
    const { db } = ctx.deps;
    const me = await ctx.me();
    if (!canWrite(me)) throw forbidden();
    const { row: existing } = await ownTask(ctx, taskId);
    const parsed = parseInput(commentSchema, { body: body ?? undefined });

    const [row] = await db.insert(comments).values({ taskId: existing.id, authorId: me.id, body: parsed.body }).returning();
    const comment: Comment = {
      id: row!.id,
      author: toSummary({ id: me.id, name: me.name }),
      body: row!.body,
      createdAt: iso(row!.createdAt),
    };
    return comment;
  },
};
