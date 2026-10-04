import { createProjectSchema, updateProjectSchema } from "@trestle/api-client/schemas";
import type { Project } from "@trestle/api-client/types";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";

import { audit, canWrite, isAdmin, requireAuth, toSummary, type Deps, type Env } from "../context";
import { schema, type Db } from "../db";
import { fail, forbidden, ilike, isUniqueViolation, iso, notFound, oneOf, pageParams, parseJson, slugify } from "../lib/http";
import { listTasks } from "./tasks";

const { projects, projectMembers, tasks, users } = schema;

export const PROJECT_STATUSES = schema.projectStatus.enumValues;

type ProjectRow = typeof projects.$inferSelect;

/**
 * Turns project rows into API projects with two queries however many rows there are: one for the
 * members of all of them, one for task counts (progress is derived from tasks, so it cannot drift).
 */
export async function hydrateProjects(db: Db, rows: ProjectRow[]): Promise<Project[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((p) => p.id);

  const [memberRows, progressRows] = await Promise.all([
    db
      .select({ projectId: projectMembers.projectId, id: users.id, name: users.name })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(inArray(projectMembers.projectId, ids))
      .orderBy(asc(projectMembers.addedAt), asc(users.id)),
    db
      .select({
        projectId: tasks.projectId,
        total: count(),
        done: sql<number>`count(*) filter (where ${tasks.status} = 'done')`.mapWith(Number),
      })
      .from(tasks)
      .where(inArray(tasks.projectId, ids))
      .groupBy(tasks.projectId),
  ]);

  const members = new Map<string, Project["members"]>();
  for (const m of memberRows) (members.get(m.projectId) ?? members.set(m.projectId, []).get(m.projectId)!).push(toSummary(m));
  const progress = new Map(progressRows.map((p) => [p.projectId, p.total ? Math.round((p.done / p.total) * 100) : 0]));

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    color: p.color,
    status: p.status,
    progress: progress.get(p.id) ?? 0,
    members: members.get(p.id) ?? [],
    dueDate: p.dueDate,
    updatedAt: iso(p.updatedAt),
  }));
}

export async function findProject(db: Db, orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.orgId, orgId)));
  return row;
}

export function projectRoutes(deps: Deps) {
  const { db } = deps;
  const app = new Hono<Env>();
  app.use("*", requireAuth(deps));

  app.get("/", async (c) => {
    const me = c.get("me");
    const { limit, offset, page, pageSize } = pageParams(c);
    const q = c.req.query("q")?.trim();
    const status = oneOf(c.req.query("status"), PROJECT_STATUSES);

    const where = and(
      eq(projects.orgId, me.orgId),
      status ? eq(projects.status, status) : undefined,
      q ? sql`(${ilike(projects.name, q)} or ${ilike(projects.description, q)})` : undefined,
    );

    const [rows, [counted]] = await Promise.all([
      db.select().from(projects).where(where).orderBy(desc(projects.updatedAt), asc(projects.id)).limit(limit).offset(offset),
      db.select({ total: count() }).from(projects).where(where),
    ]);
    return c.json({ data: await hydrateProjects(db, rows), meta: { page, pageSize, total: counted?.total ?? 0 } });
  });

  app.post("/", async (c) => {
    const me = c.get("me");
    if (!canWrite(me)) return forbidden(c);
    const parsed = await parseJson(c, createProjectSchema);
    if (!parsed.ok) return parsed.response;
    const { name, description, dueDate, color, status } = parsed.data;

    const base = slugify(name) || "project";
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = attempt === 0 ? base : `${base}-${attempt === 1 ? 2 : Math.random().toString(36).slice(2, 6)}`;
      try {
        const row = await db.transaction(async (tx) => {
          const [project] = await tx
            .insert(projects)
            .values({
              id,
              orgId: me.orgId,
              name,
              description: description ?? "",
              color: color ?? "purple",
              status: status ?? "planning",
              dueDate: dueDate || null,
            })
            .returning();
          await tx.insert(projectMembers).values({ projectId: id, userId: me.id });
          await tx.insert(schema.auditLog).values({ orgId: me.orgId, actor: me.email, action: "create_project", target: name });
          return project!;
        });
        const [created] = await hydrateProjects(db, [row]);
        return c.json({ data: created }, 201);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    return fail(c, 409, "slug_taken", "Could not pick a unique id for this project, try a different name");
  });

  app.get("/:id", async (c) => {
    const row = await findProject(db, c.get("me").orgId, c.req.param("id"));
    if (!row) return notFound(c, "Project");
    const [project] = await hydrateProjects(db, [row]);
    return c.json({ data: project });
  });

  app.patch("/:id", async (c) => {
    const me = c.get("me");
    if (!canWrite(me)) return forbidden(c);
    const parsed = await parseJson(c, updateProjectSchema);
    if (!parsed.ok) return parsed.response;
    const { name, description, color, status, dueDate } = parsed.data;

    const patch: Partial<typeof projects.$inferInsert> = {};
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description;
    if (color !== undefined) patch.color = color;
    if (status !== undefined) patch.status = status;
    if (dueDate !== undefined) patch.dueDate = dueDate || null;

    // Always bumps updated_at (via $onUpdate), even for an empty patch.
    const [row] = await db
      .update(projects)
      .set(patch)
      .where(and(eq(projects.id, c.req.param("id")), eq(projects.orgId, me.orgId)))
      .returning();
    if (!row) return notFound(c, "Project");
    const [project] = await hydrateProjects(db, [row]);
    return c.json({ data: project });
  });

  // Tasks and membership go with the project (ON DELETE CASCADE).
  app.delete("/:id", async (c) => {
    const me = c.get("me");
    if (!isAdmin(me)) return forbidden(c, "Only owners and admins can delete a project");

    const [row] = await db
      .delete(projects)
      .where(and(eq(projects.id, c.req.param("id")), eq(projects.orgId, me.orgId)))
      .returning({ name: projects.name });
    if (!row) return notFound(c, "Project");
    await audit(db, { orgId: me.orgId, actor: me.email, action: "delete_project", target: row.name });
    return c.body(null, 204);
  });

  app.get("/:id/tasks", async (c) => {
    const me = c.get("me");
    if (!(await findProject(db, me.orgId, c.req.param("id")))) return notFound(c, "Project");
    return c.json(await listTasks(db, me, { projectId: c.req.param("id") }, pageParams(c)));
  });

  return app;
}
