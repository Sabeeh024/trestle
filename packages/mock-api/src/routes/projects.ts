import { Hono } from "hono";

import type { Db } from "../db";
import { createProjectSchema } from "@trestle/api-client/schemas";
import { userFromRequest } from "./auth";
import { matches, notFound, oneOf, paginate, parseBody, readBody, str } from "../http";
import type { CategoricalColor, ProjectStatus } from "@trestle/api-client/types";

const COLORS = ["purple", "cyan", "green", "orange", "blue", "pink"] as const satisfies readonly CategoricalColor[];
const STATUSES = ["active", "planning", "onHold", "archived"] as const satisfies readonly ProjectStatus[];

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function projectRoutes(db: Db) {
  const app = new Hono();

  app.get("/", (c) => {
    const q = c.req.query("q");
    const status = oneOf(c.req.query("status"), STATUSES);
    const items = db.state.projects
      .filter((p) => (!status || p.status === status) && matches(q, p.name, p.description))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((p) => db.project(p));
    return c.json(paginate(c, items));
  });

  app.post("/", async (c) => {
    const body = await readBody(c);
    const parsed = parseBody(c, createProjectSchema, body);
    if (!parsed.ok) return parsed.response;
    const { name, description, dueDate } = parsed.data;

    let id = slugify(name) || db.nextId("project");
    if (db.state.projects.some((p) => p.id === id)) id = `${id}-${db.nextId("copy")}`;

    const record = {
      id,
      name,
      description: description ?? "",
      color: oneOf(body.color, COLORS) ?? "purple",
      status: oneOf(body.status, STATUSES) ?? "planning",
      progress: 0,
      memberIds: [(userFromRequest(c, db) ?? db.me).id],
      dueDate: dueDate || null,
      updatedAt: new Date().toISOString(),
    };
    db.state.projects.push(record);
    db.log("create_project", name);
    return c.json({ data: db.project(record) }, 201);
  });

  app.get("/:id", (c) => {
    const record = db.state.projects.find((p) => p.id === c.req.param("id"));
    return record ? c.json({ data: db.project(record) }) : notFound(c, "Project");
  });

  app.patch("/:id", async (c) => {
    const record = db.state.projects.find((p) => p.id === c.req.param("id"));
    if (!record) return notFound(c, "Project");

    const body = await readBody(c);
    record.name = str(body.name) ?? record.name;
    if (typeof body.description === "string") record.description = body.description;
    record.color = oneOf(body.color, COLORS) ?? record.color;
    record.status = oneOf(body.status, STATUSES) ?? record.status;
    if (typeof body.progress === "number") record.progress = Math.min(100, Math.max(0, Math.round(body.progress)));
    if (body.dueDate === null || typeof body.dueDate === "string") record.dueDate = body.dueDate;
    record.updatedAt = new Date().toISOString();
    return c.json({ data: db.project(record) });
  });

  app.delete("/:id", (c) => {
    const index = db.state.projects.findIndex((p) => p.id === c.req.param("id"));
    const record = db.state.projects[index];
    if (!record) return notFound(c, "Project");

    db.state.projects.splice(index, 1);
    db.state.tasks = db.state.tasks.filter((t) => t.projectId !== record.id);
    db.log("delete_project", record.name);
    return c.body(null, 204);
  });

  app.get("/:id/tasks", (c) => {
    const id = c.req.param("id");
    if (!db.state.projects.some((p) => p.id === id)) return notFound(c, "Project");
    return c.json(paginate(c, db.state.tasks.filter((t) => t.projectId === id).map((t) => db.task(t))));
  });

  return app;
}
