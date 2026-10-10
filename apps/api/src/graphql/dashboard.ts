import type { DashboardData } from "@trestle/api-client/types";
import { and, asc, desc, eq, ne } from "drizzle-orm";

import { toUser, userColumns } from "../context";
import { schema } from "../db";
import type { GqlContext } from "./context";
import { hydrateProjects } from "./resolvers/projects";
import { listTasks } from "./resolvers/tasks";

const { users, projects } = schema;

/** Everything the dashboard screen shows, in one round trip. */
export const dashboard = async (_: unknown, ctx: GqlContext): Promise<DashboardData> => {
  const { db } = ctx.deps;
  const me = await ctx.me();
  const [[self], recent, mine] = await Promise.all([
    db.select(userColumns).from(users).where(eq(users.id, me.id)),
    db
      .select()
      .from(projects)
      .where(and(eq(projects.orgId, me.orgId), ne(projects.status, "archived")))
      .orderBy(desc(projects.updatedAt), asc(projects.id))
      .limit(4),
    listTasks(db, me, { assignee: "me" }, { page: 1, pageSize: 200, limit: 200, offset: 0 }),
  ]);
  return { me: toUser(self!), recentProjects: await hydrateProjects(db, recent), myTasks: mine.data };
};
