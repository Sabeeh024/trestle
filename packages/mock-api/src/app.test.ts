import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { createApp } from "./app";
import { Db } from "./db";
import type { AdminUser, AuditLogEntry, DashboardData, Paginated, Project, Task, TaskDetail } from "./types";

const db = new Db();
const app = createApp({ db });

beforeEach(() => db.reset());

async function call<T>(path: string, init?: { method?: string; body?: unknown; headers?: Record<string, string> }) {
  const res = await app.request(path, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", ...init?.headers },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, json: (text ? JSON.parse(text) : null) as T };
}

describe("auth", () => {
  it("logs in a known user and rejects bad credentials", async () => {
    const ok = await call<{ data: { token: string } }>("/api/auth/login", { method: "POST", body: { email: "jordan.kim@trestle.io", password: "x" } });
    assert.equal(ok.status, 200);
    assert.match(ok.json.data.token, /^mock-token-/);

    const bad = await call("/api/auth/login", { method: "POST", body: { email: "jordan.kim@trestle.io", password: "wrong" } });
    assert.equal(bad.status, 401);
  });

  it("refuses suspended accounts", async () => {
    const res = await call("/api/auth/login", { method: "POST", body: { email: "tom.baker@haldane.co", password: "x" } });
    assert.equal(res.status, 403);
  });
});

describe("product API", () => {
  it("serves the dashboard", async () => {
    const { json } = await call<{ data: DashboardData }>("/api/dashboard");
    assert.equal(json.data.me.name, "Jordan Kim");
    assert.equal(json.data.recentProjects.length, 4);
    assert.ok(json.data.myTasks.every((t) => t.assignee?.id === json.data.me.id));
  });

  it("filters projects and 404s on unknown ids", async () => {
    const list = await call<Paginated<Project>>("/api/projects?status=planning");
    assert.deepEqual(list.json.data.map((p) => p.id), ["design-system-audit"]);
    assert.equal((await call("/api/projects/nope")).status, 404);
  });

  it("creates a project and writes an audit entry", async () => {
    const created = await call<{ data: Project }>("/api/projects", { method: "POST", body: { name: "Brand Refresh" } });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.id, "brand-refresh");

    const audit = await call<Paginated<AuditLogEntry>>("/api/admin/audit-log?action=create_project");
    assert.equal(audit.json.data[0]?.target, "Brand Refresh");
  });

  it("lists a project's tasks and updates a task", async () => {
    const tasks = await call<Paginated<Task>>("/api/projects/website-redesign/tasks");
    assert.equal(tasks.json.meta.total, 6);

    const patched = await call<{ data: TaskDetail }>("/api/tasks/TASK-104", { method: "PATCH", body: { status: "done" } });
    assert.equal(patched.json.data.status, "done");
    assert.equal(patched.json.data.comments.length, 2);
  });

  it("adds comments and rejects an empty one", async () => {
    const ok = await call("/api/tasks/TASK-104/comments", { method: "POST", body: { body: "On it" } });
    assert.equal(ok.status, 201);
    assert.equal((await call("/api/tasks/TASK-104/comments", { method: "POST", body: { body: " " } })).status, 400);
    const detail = await call<{ data: TaskDetail }>("/api/tasks/TASK-104");
    assert.equal(detail.json.data.comments.length, 3);
  });

  it("deleting a project removes its tasks", async () => {
    assert.equal((await call("/api/projects/website-redesign", { method: "DELETE" })).status, 204);
    const tasks = await call<Paginated<Task>>("/api/tasks?projectId=website-redesign");
    assert.equal(tasks.json.meta.total, 0);
  });
});

describe("admin API", () => {
  it("searches, filters, sorts and paginates users", async () => {
    const search = await call<Paginated<AdminUser>>("/api/admin/users?q=northwind");
    assert.equal(search.json.meta.total, 2);
    assert.equal(search.json.data[0]?.orgName, "Northwind");

    const suspended = await call<Paginated<AdminUser>>("/api/admin/users?status=suspended");
    assert.deepEqual(suspended.json.data.map((u) => u.name), ["Tom Baker"]);

    const page = await call<Paginated<AdminUser>>("/api/admin/users?pageSize=3&page=2&sort=name&direction=desc");
    assert.equal(page.json.data.length, 3);
    assert.equal(page.json.meta.total, 9);
  });

  it("suspends and reinstates a user, logging both", async () => {
    const suspended = await call<{ data: AdminUser }>("/api/admin/users/usr_000001/suspend", { method: "POST" });
    assert.equal(suspended.json.data.status, "suspended");
    const reinstated = await call<{ data: AdminUser }>("/api/admin/users/usr_000001/reinstate", { method: "POST" });
    assert.equal(reinstated.json.data.status, "active");

    const audit = await call<Paginated<AuditLogEntry>>("/api/admin/audit-log?q=alex.kim");
    assert.deepEqual(
      audit.json.data.filter((e) => e.target === "alex.kim@northwind.io").map((e) => e.action),
      ["reinstate_user", "suspend_user"],
    );
  });

  it("will not let you act on your own account", async () => {
    assert.equal((await call("/api/admin/users/usr_000003/suspend", { method: "POST" })).status, 409);
    assert.equal((await call("/api/admin/users/usr_000003", { method: "DELETE" })).status, 409);
    assert.equal((await call("/api/admin/users/bulk", { method: "POST", body: { action: "delete", ids: ["usr_000003"] } })).status, 409);
  });

  it("invites a user, rejecting duplicates", async () => {
    const body = { email: "new.person@northwind.io", orgId: "org_northwind" };
    const first = await call<{ data: AdminUser }>("/api/admin/users/invite", { method: "POST", body });
    assert.equal(first.status, 201);
    assert.equal(first.json.data.status, "invited");
    assert.equal((await call("/api/admin/users/invite", { method: "POST", body })).status, 409);
  });

  it("bulk suspends users", async () => {
    const res = await call<{ data: { affected: number } }>("/api/admin/users/bulk", { method: "POST", body: { action: "suspend", ids: ["usr_000001", "usr_000002"] } });
    assert.equal(res.json.data.affected, 2);
  });

  it("lists organizations with member counts", async () => {
    const res = await call<Paginated<{ name: string; memberCount: number }>>("/api/admin/organizations?q=trestle");
    assert.deepEqual(res.json.data.map((o) => [o.name, o.memberCount]), [["Trestle Labs", 2]]);
  });
});

describe("options", () => {
  it("enforces auth and admin role when requireAuth is on", async () => {
    const guarded = createApp({ db, requireAuth: true });
    const get = (path: string, token?: string) => guarded.request(path, token ? { headers: { authorization: `Bearer ${token}` } } : {});

    assert.equal((await get("/api/projects")).status, 401);
    assert.equal((await get("/api/projects", "mock-token-usr_000003")).status, 200);
    assert.equal((await get("/api/admin/users", "mock-token-usr_000002")).status, 403);
    assert.equal((await get("/api/admin/users", "mock-token-usr_000003")).status, 200);
  });

  it("returns a JSON error for unknown routes", async () => {
    const res = await call<{ error: { code: string } }>("/api/nope");
    assert.equal(res.status, 404);
    assert.equal(res.json.error.code, "not_found");
  });
});
