import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { Db } from "./db";
import { fail } from "./http";
import { adminRoutes } from "./routes/admin";
import { authRoutes, userFromRequest } from "./routes/auth";
import { projectRoutes } from "./routes/projects";
import { taskRoutes } from "./routes/tasks";
import type { DashboardData } from "./types";

export interface AppOptions {
  db?: Db;
  latencyMs?: number;
  requireAuth?: boolean;
  log?: boolean;
}

export function createApp({ db = new Db(), latencyMs = 0, requireAuth = false, log = false }: AppOptions = {}) {
  const app = new Hono();

  if (log) app.use(logger());
  app.use("*", cors());

  if (latencyMs > 0) {
    app.use("/api/*", async (_c, next) => {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
      await next();
    });
  }

  if (requireAuth) {
    app.use("/api/*", async (c, next) => {
      if (c.req.path === "/api/auth/login") return next();
      if (!userFromRequest(c, db)) return fail(c, 401, "unauthenticated", "Sign in to continue");
      return next();
    });
    app.use("/api/admin/*", async (c, next) => {
      const role = userFromRequest(c, db)?.role;
      if (role !== "owner" && role !== "admin") return fail(c, 403, "forbidden", "Admin access required");
      return next();
    });
  }

  app.get("/health", (c) => c.json({ ok: true }));

  // Restores the seed data, so a dev or test run can start clean without restarting the server.
  app.post("/__reset", (c) => {
    db.reset();
    return c.body(null, 204);
  });

  app.route("/api/auth", authRoutes(db));
  app.route("/api/projects", projectRoutes(db));
  app.route("/api/tasks", taskRoutes(db));
  app.route("/api/admin", adminRoutes(db));

  app.get("/api/dashboard", (c) => {
    const me = userFromRequest(c, db) ?? db.me;
    const recentProjects = [...db.state.projects]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 4)
      .map((p) => db.project(p));
    const myTasks = db.state.tasks
      .filter((t) => t.assigneeId === me.id)
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
      .map((t) => db.task(t));
    const data: DashboardData = { me, recentProjects, myTasks };
    return c.json({ data });
  });

  app.notFound((c) => fail(c, 404, "not_found", `No route for ${c.req.method} ${c.req.path}`));
  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: { code: "internal_error", message: "Something went wrong" } }, 500);
  });

  return app;
}
