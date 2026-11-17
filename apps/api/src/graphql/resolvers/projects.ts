import { createProjectSchema, updateProjectSchema } from "@trestle/api-client/schemas";
import type { Project } from "@trestle/api-client/types";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import { audit, canWrite, isAdmin, toSummary } from "../../context";
import { schema, type Db } from "../../db";
import { ilike, isUniqueViolation, iso, pageFrom, slugify } from "../../lib/http";
import type { GqlContext } from "../context";
import { conflict, forbidden, notFound } from "../errors";
import { parseInput } from "../input";
import { listTasks } from "./tasks";

const { projects, projectMembers, tasks, users } = schema;

type ProjectRow = typeof projects.$inferSelect;
type Input = { input: unknown };
type PageArgs = { page?: number | null; pageSize?: number | null };

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

export const projectQueries = {
  projects: async (args: PageArgs & { q?: string | null; status?: Project["status"] | null }, ctx: GqlContext) => {
    const { db } = ctx.deps;
    const me = await ctx.me();
    const { limit, offset, page, pageSize } = pageFrom(args);
    const q = args.q?.trim();

    const where = and(
      eq(projects.orgId, me.orgId),
      args.status ? eq(projects.status, args.status) : undefined,
      q ? sql`(${ilike(projects.name, q)} or ${ilike(projects.description, q)})` : undefined,
    );

    const [rows, [counted]] = await Promise.all([
      db.select().from(projects).where(where).orderBy(desc(projects.updatedAt), asc(projects.id)).limit(limit).offset(offset),
      db.select({ total: count() }).from(projects).where(where),
    ]);
    return { data: await hydrateProjects(db, rows), meta: { page, pageSize, total: counted?.total ?? 0 } };
  },

  project: async ({ id }: { id: string }, ctx: GqlContext) => {
    const { db } = ctx.deps;
    const row = await findProject(db, (await ctx.me()).orgId, id);
    if (!row) throw notFound("Project");
    return (await hydrateProjects(db, [row]))[0]!;
  },

  projectTasks: async ({ id, ...paging }: { id: string } & PageArgs, ctx: GqlContext) => {
    const me = await ctx.me();
    if (!(await findProject(ctx.deps.db, me.orgId, id))) throw notFound("Project");
    return listTasks(ctx.deps.db, me, { projectId: id }, pageFrom(paging));
  },
};

export const projectMutations = {
  createProject: async ({ input }: Input, ctx: GqlContext) => {
    const { db } = ctx.deps;
    const me = await ctx.me();
    if (!canWrite(me)) throw forbidden();
    const { name, description, dueDate, color, status } = parseInput(createProjectSchema, input);

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
        return (await hydrateProjects(db, [row]))[0]!;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw conflict("slug_taken", "Could not pick a unique id for this project, try a different name");
  },

  updateProject: async ({ id, input }: { id: string } & Input, ctx: GqlContext) => {
    const { db } = ctx.deps;
    const me = await ctx.me();
    if (!canWrite(me)) throw forbidden();
    const { name, description, color, status, dueDate } = parseInput(updateProjectSchema, input);

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
      .where(and(eq(projects.id, id), eq(projects.orgId, me.orgId)))
      .returning();
    if (!row) throw notFound("Project");
    return (await hydrateProjects(db, [row]))[0]!;
  },

  // Tasks and membership go with the project (ON DELETE CASCADE).
  deleteProject: async ({ id }: { id: string }, ctx: GqlContext) => {
    const { db } = ctx.deps;
    const me = await ctx.me();
    if (!isAdmin(me)) throw forbidden("Only owners and admins can delete a project");

    const [row] = await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.orgId, me.orgId)))
      .returning({ name: projects.name });
    if (!row) throw notFound("Project");
    await audit(db, { orgId: me.orgId, actor: me.email, action: "delete_project", target: row.name });
    return true;
  },
};
