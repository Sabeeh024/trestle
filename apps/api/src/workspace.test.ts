import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { EMAIL, setup } from "./test-utils";

describe("projects, tasks and the dashboard", async () => {
  const t = await setup();
  beforeEach(() => t.reset());
  after(() => t.close());

  const jordan = () => t.login(EMAIL.jordan);

  describe("projects", () => {
    it("lists the organization's projects, newest activity first, with members and derived progress", async () => {
      const res = await t.request("GET", "/api/projects", { token: await jordan() });
      assert.equal(res.status, 200);
      assert.equal(res.body.meta.total, 7);
      assert.equal(res.body.data[0].id, "website-redesign");

      const site = res.body.data[0];
      assert.deepEqual(site.members.map((m: { name: string }) => m.name).sort(), ["Jamie Singh", "Jordan Kim"]);
      // 1 of 6 tasks is done.
      assert.equal(site.progress, 17);
      const empty = res.body.data.find((p: { id: string }) => p.id === "customer-portal");
      assert.equal(empty.progress, 0);
    });

    it("filters by status and search, and paginates with a correct total", async () => {
      const token = await jordan();
      const archived = await t.request("GET", "/api/projects?status=archived", { token });
      assert.deepEqual(archived.body.data.map((p: { id: string }) => p.id), ["holiday-campaign-2025"]);

      const search = await t.request("GET", "/api/projects?q=CAMPAIGN", { token });
      assert.equal(search.body.meta.total, 2);

      const page = await t.request("GET", "/api/projects?pageSize=3&page=3", { token });
      assert.equal(page.body.data.length, 1);
      assert.deepEqual(page.body.meta, { page: 3, pageSize: 3, total: 7 });
    });

    it("treats % and _ in a search as literal characters", async () => {
      const token = await jordan();
      assert.equal((await t.request("GET", "/api/projects?q=%25", { token })).body.meta.total, 0);
      assert.equal((await t.request("GET", "/api/projects?q=_", { token })).body.meta.total, 0);
    });

    it("creates a project with a unique slug, the creator as member, and an audit entry", async () => {
      const token = await jordan();
      const first = await t.request("POST", "/api/projects", { token, body: { name: "Brand Refresh!", description: "Logo and palette", dueDate: "2026-12-01", color: "pink" } });
      assert.equal(first.status, 201);
      assert.equal(first.body.data.id, "brand-refresh");
      assert.equal(first.body.data.color, "pink");
      assert.equal(first.body.data.status, "planning");
      assert.equal(first.body.data.dueDate, "2026-12-01");
      assert.deepEqual(first.body.data.members.map((m: { name: string }) => m.name), ["Jordan Kim"]);

      const second = await t.request("POST", "/api/projects", { token, body: { name: "Brand Refresh" } });
      assert.equal(second.status, 201);
      assert.notEqual(second.body.data.id, "brand-refresh");

      const log = await t.request("GET", "/api/admin/audit-log?action=create_project&q=Brand", { token });
      assert.equal(log.body.meta.total, 2);
    });

    it("validates input with message keys", async () => {
      const res = await t.request("POST", "/api/projects", { token: await jordan(), body: { name: "", dueDate: "tomorrow", color: "red" } });
      assert.equal(res.status, 422);
      assert.deepEqual(res.body.error.fields, { name: "required", color: "invalidChoice", dueDate: "dateInvalid" });
    });

    it("updates fields, can clear the due date, and moves the project to the top of recent activity", async () => {
      const token = await jordan();
      const res = await t.request("PATCH", "/api/projects/design-system-audit", { token, body: { name: "Design System Review", status: "active", dueDate: null } });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.name, "Design System Review");
      assert.equal(res.body.data.dueDate, null);
      const list = await t.request("GET", "/api/projects", { token });
      assert.equal(list.body.data[0].id, "design-system-audit");

      assert.equal((await t.request("PATCH", "/api/projects/nope", { token, body: { name: "x" } })).status, 404);
    });

    it("deletes a project together with its tasks", async () => {
      const token = await jordan();
      assert.equal((await t.request("DELETE", "/api/projects/website-redesign", { token })).status, 204);
      assert.equal((await t.request("GET", "/api/projects/website-redesign", { token })).status, 404);
      assert.equal((await t.request("GET", "/api/tasks/TASK-104", { token })).status, 404);
      assert.equal((await t.request("DELETE", "/api/projects/website-redesign", { token })).status, 404);
    });

    it("only lets owners and admins delete, and viewers not write at all", async () => {
      const jamie = await t.login(EMAIL.jamie);
      assert.equal((await t.request("DELETE", "/api/projects/website-redesign", { token: jamie })).status, 403);

      // Make Jamie a viewer: read-only.
      const admin = await jordan();
      const id = (await t.request("GET", "/api/admin/users?q=jamie", { token: admin })).body.data[0].id;
      await t.request("PATCH", `/api/admin/users/${id}`, { token: admin, body: { role: "viewer" } });
      assert.equal((await t.request("GET", "/api/projects", { token: jamie })).status, 200);
      assert.equal((await t.request("POST", "/api/projects", { token: jamie, body: { name: "Nope" } })).status, 403);
      assert.equal((await t.request("POST", "/api/tasks/TASK-104/comments", { token: jamie, body: { body: "hi" } })).status, 403);
    });
  });

  describe("tasks", () => {
    it("lists tasks with the assignee, soonest due first and undated last", async () => {
      const res = await t.request("GET", "/api/tasks?projectId=website-redesign", { token: await jordan() });
      assert.equal(res.body.meta.total, 6);
      assert.deepEqual(res.body.data.map((x: { id: string }) => x.id), ["TASK-104", "TASK-73", "TASK-98", "TASK-87", "TASK-121", "TASK-56"]);
      assert.deepEqual(res.body.data[0].assignee, { id: res.body.data[0].assignee.id, name: "Jamie Singh", initials: "JS" });
    });

    it("filters by assignee=me, status, priority and search (including by key)", async () => {
      const token = await jordan();
      const mine = await t.request("GET", "/api/tasks?assignee=me", { token });
      assert.equal(mine.body.meta.total, 6);
      assert.ok(mine.body.data.every((x: { assignee: { name: string } }) => x.assignee.name === "Jordan Kim"));

      assert.equal((await t.request("GET", "/api/tasks?status=done", { token })).body.meta.total, 1);
      assert.equal((await t.request("GET", "/api/tasks?priority=urgent", { token })).body.meta.total, 1);
      assert.equal((await t.request("GET", "/api/tasks?q=safari", { token })).body.data[0].id, "TASK-104");
      assert.equal((await t.request("GET", "/api/tasks?q=task-112", { token })).body.data[0].id, "TASK-112");
      // A malformed assignee id matches nothing instead of erroring.
      assert.equal((await t.request("GET", "/api/tasks?assignee=not-a-uuid", { token })).body.meta.total, 0);
    });

    it("returns a task with its comments in order, and 404s on unknown or malformed keys", async () => {
      const token = await jordan();
      const res = await t.request("GET", "/api/tasks/TASK-104", { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.comments.length, 2);
      assert.equal(res.body.data.comments[0].author.name, "Jordan Kim");
      assert.match(res.body.data.comments[1].body, /SameSite=Lax/);

      assert.equal((await t.request("GET", "/api/tasks/TASK-99999", { token })).status, 404);
      assert.equal((await t.request("GET", "/api/tasks/banana", { token })).status, 404);
    });

    it("creates a task with the next number, validating the project and the assignee", async () => {
      const token = await jordan();
      const jamieId = (await t.request("GET", "/api/tasks/TASK-104", { token })).body.data.assignee.id;
      const created = await t.request("POST", "/api/tasks", { token, body: { projectId: "mobile-app-v2", title: "Plan beta", priority: "high", assigneeId: jamieId, dueDate: "2026-10-30" } });
      assert.equal(created.status, 201);
      assert.equal(created.body.data.id, "TASK-132");
      assert.equal(created.body.data.status, "todo");
      assert.equal(created.body.data.assignee.name, "Jamie Singh");
      assert.deepEqual(created.body.data.comments, []);

      assert.equal((await t.request("POST", "/api/tasks", { token, body: { projectId: "ghost", title: "x" } })).status, 400);
      assert.equal((await t.request("POST", "/api/tasks", { token, body: { projectId: "mobile-app-v2", title: "x", assigneeId: "nobody" } })).status, 400);
      const invalid = await t.request("POST", "/api/tasks", { token, body: { projectId: "mobile-app-v2", title: "", priority: "asap" } });
      assert.deepEqual(invalid.body.error.fields, { title: "required", priority: "invalidChoice" });
    });

    it("updates a task, including unassigning and clearing the due date, and updates progress", async () => {
      const token = await jordan();
      const res = await t.request("PATCH", "/api/tasks/TASK-87", { token, body: { status: "done", assigneeId: null, dueDate: null, title: "Write the Q3 brief" } });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, "done");
      assert.equal(res.body.data.assignee, null);
      assert.equal(res.body.data.dueDate, null);
      assert.equal(res.body.data.title, "Write the Q3 brief");

      const project = await t.request("GET", "/api/projects/website-redesign", { token });
      assert.equal(project.body.data.progress, 33); // 2 of 6
    });

    it("adds a comment as the signed-in user and deletes tasks with their comments", async () => {
      const token = await t.login(EMAIL.jamie);
      const res = await t.request("POST", "/api/tasks/TASK-104/comments", { token, body: { body: "Fixed in main." } });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.author.name, "Jamie Singh");
      assert.equal((await t.request("GET", "/api/tasks/TASK-104", { token })).body.data.comments.length, 3);

      assert.equal((await t.request("POST", "/api/tasks/TASK-104/comments", { token, body: { body: "   " } })).status, 422);
      assert.equal((await t.request("DELETE", "/api/tasks/TASK-104", { token })).status, 204);
      assert.equal((await t.request("GET", "/api/tasks/TASK-104", { token })).status, 404);
    });

    it("keeps a task's comments readable after its author is deleted", async () => {
      const admin = await jordan();
      const jamieId = (await t.request("GET", "/api/admin/users?q=jamie", { token: admin })).body.data[0].id;
      assert.equal((await t.request("DELETE", `/api/admin/users/${jamieId}`, { token: admin })).status, 204);
      const task = await t.request("GET", "/api/tasks/TASK-104", { token: admin });
      assert.equal(task.body.data.assignee, null);
      assert.equal(task.body.data.comments[1].author.name, "Deleted user");
    });
  });

  describe("dashboard", () => {
    it("returns the user, up to four recent non-archived projects, and their tasks", async () => {
      const res = await t.request("GET", "/api/dashboard", { token: await jordan() });
      assert.equal(res.status, 200);
      const { me, recentProjects, myTasks } = res.body.data;
      assert.equal(me.email, EMAIL.jordan);
      assert.equal(recentProjects.length, 4);
      assert.ok(recentProjects.every((p: { status: string }) => p.status !== "archived"));
      assert.equal(myTasks.length, 6);
      assert.equal((await t.request("GET", "/api/dashboard")).status, 401);
    });
  });

  describe("tenant isolation", () => {
    it("never shows or touches another organization's data", async () => {
      const outsider = await t.login(EMAIL.alex); // admin of a different organization
      assert.equal((await t.request("GET", "/api/projects", { token: outsider })).body.meta.total, 0);
      assert.equal((await t.request("GET", "/api/projects/website-redesign", { token: outsider })).status, 404);
      assert.equal((await t.request("PATCH", "/api/projects/website-redesign", { token: outsider, body: { name: "Hacked" } })).status, 404);
      assert.equal((await t.request("DELETE", "/api/projects/website-redesign", { token: outsider })).status, 404);
      assert.equal((await t.request("GET", "/api/tasks/TASK-104", { token: outsider })).status, 404);
      assert.equal((await t.request("GET", "/api/tasks", { token: outsider })).body.meta.total, 0);
      assert.equal((await t.request("POST", "/api/tasks/TASK-104/comments", { token: outsider, body: { body: "hi" } })).status, 404);
      assert.equal((await t.request("PATCH", "/api/tasks/TASK-104", { token: outsider, body: { status: "done" } })).status, 404);
      assert.equal((await t.request("POST", "/api/tasks", { token: outsider, body: { projectId: "website-redesign", title: "Sneaky" } })).status, 400);
      assert.equal((await t.request("GET", "/api/projects/website-redesign/tasks", { token: outsider })).status, 404);
    });

    it("refuses to assign a task to someone outside the organization", async () => {
      const token = await jordan();
      const alexId = (await t.request("GET", "/api/admin/users?q=alex.kim", { token })).body.data[0].id;
      const res = await t.request("PATCH", "/api/tasks/TASK-87", { token, body: { assigneeId: alexId } });
      assert.equal(res.status, 400);
    });
  });

  describe("contact form", () => {
    it("stores a message without needing to sign in", async () => {
      const res = await t.request("POST", "/api/contact", { body: { name: "Pat", email: "Pat@Example.com", message: "Interested in Enterprise" } });
      assert.equal(res.status, 201);
      const bad = await t.request("POST", "/api/contact", { body: { name: "", email: "nope", message: "" } });
      assert.deepEqual(bad.body.error.fields, { name: "required", email: "emailInvalid", message: "required" });
    });
  });

  describe("plumbing", () => {
    it("reports health, 404s unknown routes in the error shape, and caps request bodies", async () => {
      assert.deepEqual((await t.request("GET", "/health")).body, { ok: true });
      const missing = await t.request("GET", "/api/nope");
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error.code, "not_found");

      const huge = await t.request("POST", "/api/contact", { body: { name: "x", email: "a@b.co", message: "x".repeat(1_200_000) } });
      assert.equal(huge.status, 400);
    });

    it("answers CORS preflight only for allowed origins", async () => {
      const cors = await setup({ corsOrigins: ["http://localhost:5173"] });
      const allowed = await cors.app.request("/api/projects", { method: "OPTIONS", headers: { origin: "http://localhost:5173", "access-control-request-method": "GET" } });
      assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
      const denied = await cors.app.request("/api/projects", { method: "OPTIONS", headers: { origin: "http://evil.test", "access-control-request-method": "GET" } });
      assert.equal(denied.headers.get("access-control-allow-origin"), null);
      await cors.close();
    });
  });
});
