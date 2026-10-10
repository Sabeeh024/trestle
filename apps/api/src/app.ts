import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { sessionCookieName, sessionCookieOptions } from "@trestle/auth/cookie";

import type { Config } from "./config";
import type { Deps } from "./context";
import { type Db } from "./db";
import { graphqlHandler } from "./graphql/handler";
import { fail, notFound } from "./lib/http";
import { consoleMailer, type Mailer } from "./lib/mailer";
import { clientIp, enforce, limits, RateLimiter } from "./lib/rate-limit";
import { isApiPath, serveAdmin } from "./admin-static";

export interface AppOptions {
  db: Db;
  mailer?: Mailer;
  config?: Partial<Deps["config"]>;
  corsOrigins?: string[];
  /** The running build (the git commit), reported by /health. */
  version?: string;
  /** The admin panel's production build to serve from this origin (see ADMIN_DIST). */
  adminDist?: string;
  /** Mark the session cookie Secure and give it the __Host- prefix (production, over HTTPS). */
  secureCookies?: boolean;
  /** Let clients ask the schema about itself (GraphiQL, codegen). On unless the API is serving production over HTTPS. */
  introspection?: boolean;
  /** Pass false to turn rate limiting off (tests). */
  limiter?: Deps["limiter"];
  log?: boolean;
}

export function createApp({ db, mailer = consoleMailer, config = {}, corsOrigins = [], adminDist, version, secureCookies = false, introspection = !secureCookies, limiter, log = false }: AppOptions) {
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
  const app = new Hono();

  if (log) app.use(logger());
  // This API only returns JSON: nothing on it should be framed, sniffed, scripted or cached by a shared cache.
  const apiHeaders = secureHeaders({
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    crossOriginResourcePolicy: "cross-origin",
    referrerPolicy: "no-referrer",
  });
  // Not for the admin panel's pages: it brings its own policy, and a deny-all CSP would stop it from running.
  app.use("*", (c, next) => (isApiPath(c.req.path) ? apiHeaders(c, next) : next()));
  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "private, no-store");
  });
  app.use("*", cors({
      origin: corsOrigins,
      // The admin panel is a browser app with no server of its own, so its session cookie is sent cross-origin.
      credentials: true,
      allowHeaders: ["authorization", "content-type", "x-auth-mode"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }));
  app.use("/api/*", bodyLimit({ maxSize: 1024 * 1024, onError: (c) => fail(c, 400, "bad_request", "Request body is too large") }));

  app.get("/health", async (c) => {
    try {
      await db.execute(sql`select 1`);
      return c.json({ ok: true, ...(version ? { version } : {}) });
    } catch {
      return c.json({ ok: false }, 503);
    }
  });

  // Every operation, public or signed-in, goes through this one endpoint: see graphql/.
  app.post("/api/graphql", graphqlHandler(deps, { introspection }));

  // Browsers report Content-Security-Policy violations here (see the apps' report-uri). They are only logged.
  app.post("/api/csp-report", async (c) => {
    const limited = await enforce(c, deps.limiter, limits.cspReport(clientIp(c, deps.config)));
    if (limited) return limited;
    const text = (await c.req.text().catch(() => "")).slice(0, 2000);
    console.warn(`[csp-report] ${text.replace(/\s+/g, " ")}`);
    return c.body(null, 204);
  });

  // Last of the routes, so it only sees what the API does not own.
  if (adminDist) serveAdmin(app, adminDist);

  app.notFound((c) => notFound(c, `Route ${c.req.method} ${c.req.path}`));
  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: { code: "internal_error", message: "Something went wrong" } }, 500);
  });

  return app;
}

