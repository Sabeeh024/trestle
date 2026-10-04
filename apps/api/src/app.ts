import { contactSchema } from "@trestle/api-client/schemas";
import type { DashboardData } from "@trestle/api-client/types";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import type { Config } from "./config";
import { requireAuth, toUser, userColumns, type Deps, type Env } from "./context";
import { schema, type Db } from "./db";
import { fail, notFound, parseJson } from "./lib/http";
import { consoleMailer, type Mailer } from "./lib/mailer";
import { RateLimiter } from "./lib/rate-limit";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { hydrateProjects, projectRoutes } from "./routes/projects";
import { listTasks, taskRoutes } from "./routes/tasks";

export interface AppOptions {
  db: Db;
  mailer?: Mailer;
  config?: Partial<Deps["config"]>;
  corsOrigins?: string[];
  /** Pass false to turn login throttling off (tests). */
  loginLimiter?: Deps["loginLimiter"];
  log?: boolean;
}

export function createApp({ db, mailer = consoleMailer, config = {}, corsOrigins = [], loginLimiter, log = false }: AppOptions) {
  const deps: Deps = {
    db,
    mailer,
    config: { SESSION_TTL_DAYS: 30, WEB_APP_URL: "http://localhost:3000", DEV_SSO: "0", ...config } satisfies Pick<Config, "SESSION_TTL_DAYS" | "WEB_APP_URL" | "DEV_SSO">,
    loginLimiter: loginLimiter ?? new RateLimiter(10, 15 * 60_000),
  };
  const app = new Hono<Env>();

  if (log) app.use(logger());
  app.use("*", cors({ origin: corsOrigins, allowHeaders: ["authorization", "content-type"], allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] }));
  app.use("/api/*", bodyLimit({ maxSize: 1024 * 1024, onError: (c) => fail(c, 400, "bad_request", "Request body is too large") }));

  app.get("/health", async (c) => {
    try {
      await db.execute(sql`select 1`);
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 503);
    }
  });

  app.route("/api/auth", authRoutes(deps));
  app.route("/api/projects", projectRoutes(deps));
  app.route("/api/tasks", taskRoutes(deps));
  app.route("/api/admin", adminRoutes(deps));

  // The marketing site's contact form: public, stored for the team to read.
  app.post("/api/contact", async (c) => {
    const parsed = await parseJson(c, contactSchema);
    if (!parsed.ok) return parsed.response;
    const { name, email, company, message } = parsed.data;
    await db.insert(schema.contactMessages).values({ name, email: email.toLowerCase(), company: company ?? "", message });
    return c.body(null, 201);
  });

  app.get("/api/dashboard", requireAuth(deps), async (c) => {
    const me = c.get("me");
    const [[self], recent, mine] = await Promise.all([
      db.select(userColumns).from(schema.users).where(eq(schema.users.id, me.id)),
      db
        .select()
        .from(schema.projects)
        .where(and(eq(schema.projects.orgId, me.orgId), ne(schema.projects.status, "archived")))
        .orderBy(desc(schema.projects.updatedAt), asc(schema.projects.id))
        .limit(4),
      listTasks(db, me, { assignee: "me" }, { page: 1, pageSize: 200, limit: 200, offset: 0 }),
    ]);
    const data: DashboardData = { me: toUser(self!), recentProjects: await hydrateProjects(db, recent), myTasks: mine.data };
    return c.json({ data });
  });

  app.notFound((c) => notFound(c, `Route ${c.req.method} ${c.req.path}`));
  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: { code: "internal_error", message: "Something went wrong" } }, 500);
  });

  return app;
}

