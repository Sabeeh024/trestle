import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { createApp } from "./app";
import { Db } from "./db";
import type { AdminUser, AuditLogEntry, DashboardData, LoginResult, Organization, Paginated, Project, Task, TaskDetail, User } from "@trestle/api-client/types";

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
    assert.equal((await call("/api/tasks/TASK-104/comments", { method: "POST", body: { body: " " } })).status, 422);
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

describe("validation", () => {
  type Failure = { error: { code: string; fields: Record<string, string> } };

  async function rejected(path: string, body: unknown, method = "POST") {
    const res = await call<Failure>(path, { method, body });
    assert.equal(res.status, 422);
    assert.equal(res.json.error.code, "validation_failed");
    return res.json.error.fields;
  }

  it("returns per-field message keys from the shared schemas", async () => {
    assert.deepEqual(await rejected("/api/auth/login", { email: "", password: "" }), { email: "required", password: "required" });
    assert.deepEqual(await rejected("/api/auth/login", { email: "nope", password: "x" }), { email: "emailInvalid" });
    assert.deepEqual(await rejected("/api/projects", { name: " ", dueDate: "soon" }), { name: "required", dueDate: "dateInvalid" });
    assert.deepEqual(await rejected("/api/tasks", { projectId: "website-redesign", title: "" }), { title: "required" });
    assert.deepEqual(await rejected("/api/admin/users/invite", { email: "bad", orgId: "" }), { email: "emailInvalid", orgId: "required" });
    assert.deepEqual(await rejected("/api/admin/users/usr_000001", { role: "root" }, "PATCH"), { role: "invalidChoice" });
    assert.deepEqual(await rejected("/api/admin/organizations", { name: "a".repeat(81) }), { name: "tooLong" });
  });

  it("does not create anything when validation fails", async () => {
    await rejected("/api/projects", { name: "" });
    const projects = await call<Paginated<Project>>("/api/projects?pageSize=100");
    assert.equal(projects.json.meta.total, 7);
  });

  it("accepts the empty optional values an untouched form submits", async () => {
    const created = await call<{ data: Project }>("/api/projects", { method: "POST", body: { name: "Brand Refresh", description: "", dueDate: "" } });
    assert.equal(created.status, 201);
    assert.equal(created.json.data.dueDate, null);
    assert.equal(created.json.data.description, "");
  });

  it("still returns 400 for a reference that does not exist", async () => {
    const res = await call("/api/tasks", { method: "POST", body: { projectId: "nope", title: "x" } });
    assert.equal(res.status, 400);
  });
});

describe("accounts", () => {
  type Failure = { error: { code: string; fields?: Record<string, string> } };

  it("signs up into a new trial workspace the person owns", async () => {
    const res = await call<{ data: LoginResult }>("/api/auth/signup", { method: "POST", body: { name: "Dana Lee", email: "Dana@Example.com", password: "longenough" } });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.user.role, "owner");
    assert.equal(res.json.data.user.email, "dana@example.com");
    assert.equal(res.json.data.user.initials, "DL");

    const orgs = await call<Paginated<Organization>>("/api/admin/organizations?q=Dana");
    assert.deepEqual(orgs.json.data.map((o) => [o.name, o.status, o.memberCount]), [["Dana Lee's workspace", "trialing", 1]]);
  });

  it("rejects a short password and an email that already has an account, on the right fields", async () => {
    const short = await call<Failure>("/api/auth/signup", { method: "POST", body: { name: "Dana", email: "dana@example.com", password: "short" } });
    assert.equal(short.status, 422);
    assert.deepEqual(short.json.error.fields, { password: "passwordTooShort" });

    const taken = await call<Failure>("/api/auth/signup", { method: "POST", body: { name: "Alex", email: "alex.kim@northwind.io", password: "longenough" } });
    assert.equal(taken.status, 422);
    assert.deepEqual(taken.json.error.fields, { email: "emailTaken" });
  });

  it("gives a new user an id that cannot collide after a deletion", async () => {
    await call("/api/admin/users/usr_000009", { method: "DELETE" });
    const a = await call<{ data: LoginResult }>("/api/auth/signup", { method: "POST", body: { name: "A B", email: "a@example.com", password: "longenough" } });
    const b = await call<{ data: LoginResult }>("/api/auth/signup", { method: "POST", body: { name: "C D", email: "c@example.com", password: "longenough" } });
    assert.notEqual(a.json.data.user.id, b.json.data.user.id);
  });

  it("allows single sign-on only for enterprise organizations", async () => {
    const ok = await call<{ data: LoginResult }>("/api/auth/sso", { method: "POST", body: { email: "jordan.kim@trestle.io" } });
    assert.equal(ok.status, 200);
    const pro = await call<Failure>("/api/auth/sso", { method: "POST", body: { email: "alex.kim@northwind.io" } });
    assert.equal(pro.status, 403);
    assert.equal(pro.json.error.code, "sso_not_enabled");
    const unknown = await call<Failure>("/api/auth/sso", { method: "POST", body: { email: "nobody@nowhere.io" } });
    assert.equal(unknown.json.error.code, "sso_not_enabled");
  });

  it("answers forgot-password the same for known and unknown addresses", async () => {
    assert.equal((await call("/api/auth/forgot-password", { method: "POST", body: { email: "alex.kim@northwind.io" } })).status, 204);
    assert.equal((await call("/api/auth/forgot-password", { method: "POST", body: { email: "nobody@nowhere.io" } })).status, 204);
    assert.equal((await call("/api/auth/forgot-password", { method: "POST", body: { email: "bad" } })).status, 422);
  });

  it("updates the signed-in user's profile and refuses someone else's email", async () => {
    const auth = { authorization: "Bearer mock-token-usr_000001" };
    const ok = await call<{ data: User }>("/api/auth/me", { method: "PATCH", headers: auth, body: { name: "Alexander Kim", email: "alex@northwind.io" } });
    assert.deepEqual([ok.json.data.name, ok.json.data.initials, ok.json.data.email], ["Alexander Kim", "AK", "alex@northwind.io"]);

    const clash = await call<Failure>("/api/auth/me", { method: "PATCH", headers: auth, body: { name: "Alex", email: "maya@fontaineco.com" } });
    assert.equal(clash.status, 422);
    assert.deepEqual(clash.json.error.fields, { email: "emailTaken" });
  });

  it("edits a user's name, email and role through one endpoint, logging each change", async () => {
    const res = await call<{ data: AdminUser }>("/api/admin/users/usr_000007", { method: "PATCH", body: { name: "Elena Cho-Lee", role: "admin" } });
    assert.deepEqual([res.json.data.name, res.json.data.initials, res.json.data.role], ["Elena Cho-Lee", "EC", "admin"]);
    const log = await call<Paginated<AuditLogEntry>>("/api/admin/audit-log?q=elena");
    assert.deepEqual(log.json.data.slice(0, 2).map((e) => e.action).sort(), ["update_role", "update_user"]);

    const clash = await call<Failure>("/api/admin/users/usr_000007", { method: "PATCH", body: { email: "alex.kim@northwind.io" } });
    assert.equal(clash.status, 422);
  });

  it("renames an organization and moves its plan, refusing a name already in use", async () => {
    const res = await call<{ data: Organization }>("/api/admin/organizations/org_verity", { method: "PATCH", body: { name: "Verity Labs", plan: "enterprise" } });
    assert.deepEqual([res.json.data.name, res.json.data.plan, res.json.data.memberCount], ["Verity Labs", "enterprise", 1]);
    assert.equal((await call("/api/admin/organizations/org_verity", { method: "PATCH", body: { name: "northwind" } })).status, 409);
    assert.equal((await call("/api/admin/organizations/nope", { method: "PATCH", body: { name: "x" } })).status, 404);
  });

  it("keeps archived projects out of the dashboard but in the project list", async () => {
    const dashboard = await call<{ data: DashboardData }>("/api/dashboard");
    assert.ok(dashboard.json.data.recentProjects.every((p) => p.status !== "archived"));
    const archived = await call<Paginated<Project>>("/api/projects?status=archived");
    assert.deepEqual(archived.json.data.map((p) => p.id), ["holiday-campaign-2025"]);
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
