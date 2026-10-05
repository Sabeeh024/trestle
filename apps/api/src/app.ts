import { contactSchema } from "@trestle/api-client/schemas";
import type { DashboardData } from "@trestle/api-client/types";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { sessionCookieName, sessionCookieOptions } from "@trestle/auth/cookie";

import type { Config } from "./config";
import { requireAuth, toUser, userColumns, type Deps, type Env } from "./context";
import { schema, type Db } from "./db";
import { fail, notFound, parseJson } from "./lib/http";
import { consoleMailer, type Mailer } from "./lib/mailer";
import { clientIp, enforce, limits, RateLimiter } from "./lib/rate-limit";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { hydrateProjects, projectRoutes } from "./routes/projects";
import { listTasks, taskRoutes } from "./routes/tasks";

export interface AppOptions {
  db: Db;
  mailer?: Mailer;
  config?: Partial<Deps["config"]>;
  corsOrigins?: string[];
  /** Mark the session cookie Secure and give it the __Host- prefix (production, over HTTPS). */
  secureCookies?: boolean;
  /** Pass false to turn rate limiting off (tests). */
  limiter?: Deps["limiter"];
  log?: boolean;
}

export function createApp({ db, mailer = consoleMailer, config = {}, corsOrigins = [], secureCookies = false, limiter, log = false }: AppOptions) {
  const deps: Deps = {
    db,
    mailer,
    config: { SESSION_TTL_DAYS: 30, WEB_APP_URL: "http://localhost:3000", DEV_SSO: "0", TRUST_PROXY: 0, ...config } satisfies Pick<Config, "SESSION_TTL_DAYS" | "WEB_APP_URL" | "DEV_SSO" | "TRUST_PROXY">,
    limiter: limiter ?? new RateLimiter(db),
    corsOrigins,
    cookie: {
      name: sessionCookieName(secureCookies),
      options: sessionCookieOptions({ secure: secureCookies, ttlDays: config.SESSION_TTL_DAYS ?? 30 }),
    },
  };
  const app = new Hono<Env>();

  if (log) app.use(logger());
  // This API only returns JSON: nothing on it should be framed, sniffed, scripted or cached by a shared cache.
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      crossOriginResourcePolicy: "cross-origin",
      referrerPolicy: "no-referrer",
    }),
  );
  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "private, no-store");
  });
  app.use("*", cors({
      origin: corsOrigins,
      // The admin panel is a browser app with no server of its own, so its session cookie is sent cross-origin.
      credentials: true,
      allowHeaders: ["authorization", "content-type", "x-auth-mode"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }));
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
    const limited = await enforce(c, deps.limiter, limits.contact(clientIp(c, deps.config)));
    if (limited) return limited;
    const parsed = await parseJson(c, contactSchema);
    if (!parsed.ok) return parsed.response;
    const { name, email, company, message } = parsed.data;
    await db.insert(schema.contactMessages).values({ name, email: email.toLowerCase(), company: company ?? "", message });
    return c.body(null, 201);
  });

  // Browsers report Content-Security-Policy violations here (see the apps' report-uri). They are only logged.
  app.post("/api/csp-report", async (c) => {
    const limited = await enforce(c, deps.limiter, limits.cspReport(clientIp(c, deps.config)));
    if (limited) return limited;
    const text = (await c.req.text().catch(() => "")).slice(0, 2000);
    console.warn(`[csp-report] ${text.replace(/\s+/g, " ")}`);
    return c.body(null, 204);
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

