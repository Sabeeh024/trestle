import { Hono } from "hono";

import { ME_ID, type TaskRecord } from "../data/seed";
import type { Db } from "../db";
import { commentSchema, createTaskSchema } from "@trestle/api-client/schemas";
import { userFromRequest } from "./auth";
import { badRequest, matches, notFound, oneOf, paginate, parseBody, readBody, str } from "../http";
import type { Priority, TaskStatus } from "@trestle/api-client/types";

const STATUSES = ["todo", "inProgress", "inReview", "done"] as const satisfies readonly TaskStatus[];
const PRIORITIES = ["urgent", "high", "medium", "low"] as const satisfies readonly Priority[];

export function taskRoutes(db: Db) {
  const app = new Hono();

  app.get("/", (c) => {
    const { projectId, assignee, q } = c.req.query();
    const status = oneOf(c.req.query("status"), STATUSES);
    const priority = oneOf(c.req.query("priority"), PRIORITIES);
    const assigneeId = assignee === "me" ? ME_ID : assignee;

    const items = db.state.tasks
      .filter(
        (t) =>
          (!projectId || t.projectId === projectId) &&
          (!assigneeId || t.assigneeId === assigneeId) &&
          (!status || t.status === status) &&
          (!priority || t.priority === priority) &&
          matches(q, t.title, t.id),
      )
      .map((t) => db.task(t));
    return c.json(paginate(c, items));
  });

  app.post("/", async (c) => {
    const body = await readBody(c);
    const parsed = parseBody(c, createTaskSchema, body);
    if (!parsed.ok) return parsed.response;
    const { title, projectId, description, priority, status, dueDate } = parsed.data;
    if (!db.state.projects.some((p) => p.id === projectId)) return badRequest(c, "projectId does not match a project");

    const assigneeId = str(body.assigneeId) ?? null;
    if (assigneeId && !db.user(assigneeId)) return badRequest(c, "assigneeId does not match a user");

    const highest = db.state.tasks.reduce((max, t) => Math.max(max, Number.parseInt(t.id.replace("TASK-", ""), 10) || 0), 0);
    const record: TaskRecord = {
      id: `TASK-${highest + 1}`,
      projectId,
      title,
      description: description ?? "",
      status: status ?? "todo",
      priority: priority ?? "medium",
      assigneeId,
      dueDate: dueDate || null,
      updatedAt: new Date().toISOString(),
    };
    db.state.tasks.push(record);
    return c.json({ data: db.taskDetail(record) }, 201);
  });

  app.get("/:id", (c) => {
    const record = db.state.tasks.find((t) => t.id === c.req.param("id"));
    return record ? c.json({ data: db.taskDetail(record) }) : notFound(c, "Task");
  });

  app.patch("/:id", async (c) => {
    const record = db.state.tasks.find((t) => t.id === c.req.param("id"));
    if (!record) return notFound(c, "Task");

    const body = await readBody(c);
    record.title = str(body.title) ?? record.title;
    if (typeof body.description === "string") record.description = body.description;
    record.status = oneOf(body.status, STATUSES) ?? record.status;
    record.priority = oneOf(body.priority, PRIORITIES) ?? record.priority;
    if (body.assigneeId === null || typeof body.assigneeId === "string") {
      if (typeof body.assigneeId === "string" && !db.user(body.assigneeId)) return badRequest(c, "assigneeId does not match a user");
      record.assigneeId = body.assigneeId;
    }
    if (body.dueDate === null || typeof body.dueDate === "string") record.dueDate = body.dueDate;
    record.updatedAt = new Date().toISOString();
    return c.json({ data: db.taskDetail(record) });
  });

  app.delete("/:id", (c) => {
    const index = db.state.tasks.findIndex((t) => t.id === c.req.param("id"));
    if (index === -1) return notFound(c, "Task");
    db.state.tasks.splice(index, 1);
    db.state.comments = db.state.comments.filter((cm) => cm.taskId !== c.req.param("id"));
    return c.body(null, 204);
  });

  app.post("/:id/comments", async (c) => {
    const record = db.state.tasks.find((t) => t.id === c.req.param("id"));
    if (!record) return notFound(c, "Task");

    const parsed = parseBody(c, commentSchema, await readBody(c));
    if (!parsed.ok) return parsed.response;
    const text = parsed.data.body;

    const comment = { id: db.nextId("cmt"), taskId: record.id, authorId: (userFromRequest(c, db) ?? db.me).id, body: text, createdAt: new Date().toISOString() };
    db.state.comments.push(comment);
    return c.json({ data: db.taskDetail(record).comments.find((cm) => cm.id === comment.id) }, 201);
  });

  return app;
}
