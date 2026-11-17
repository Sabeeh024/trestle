import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { EMAIL, setup } from "./test-utils";

type Named = { id: string; name: string };

describe("projects, tasks and the dashboard", async () => {
  const t = await setup();
  beforeEach(() => t.reset());
  after(() => t.close());

  const jordan = () => t.login(EMAIL.jordan);
  const as = (token: string) => ({ token });

  describe("projects", () => {
    it("lists the organization's projects, newest activity first, with members and derived progress", async () => {
      const res = await t.call("projects", {}, as(await jordan()));
      assert.equal(res.status, 200);
      assert.equal(res.data.meta.total, 7);
      assert.equal(res.data.data[0].id, "website-redesign");

      const site = res.data.data[0];
      assert.deepEqual(site.members.map((m: Named) => m.name).sort(), ["Jamie Singh", "Jordan Kim"]);
      // 1 of 6 tasks is done.
      assert.equal(site.progress, 17);
      const empty = res.data.data.find((p: Named) => p.id === "customer-portal");
      assert.equal(empty.progress, 0);
    });

    it("filters by status and search, and paginates with a correct total", async () => {
      const token = await jordan();
      const archived = await t.call("projects", { status: "archived" }, as(token));
      assert.deepEqual(archived.data.data.map((p: Named) => p.id), ["holiday-campaign-2025"]);

      assert.equal((await t.call("projects", { q: "CAMPAIGN" }, as(token))).data.meta.total, 2);

      const page = await t.call("projects", { pageSize: 3, page: 3 }, as(token));
      assert.equal(page.data.data.length, 1);
      assert.deepEqual(page.data.meta, { page: 3, pageSize: 3, total: 7 });
    });

    it("clamps a silly page size instead of failing", async () => {
      const res = await t.call("projects", { pageSize: 100000, page: -4 }, as(await jordan()));
      assert.deepEqual(res.data.meta, { page: 1, pageSize: 100, total: 7 });
    });

    it("treats % and _ in a search as literal characters", async () => {
      const token = await jordan();
      assert.equal((await t.call("projects", { q: "%" }, as(token))).data.meta.total, 0);
      assert.equal((await t.call("projects", { q: "_" }, as(token))).data.meta.total, 0);
    });

    it("creates a project with a unique slug, the creator as member, and an audit entry", async () => {
      const token = await jordan();
      const first = await t.call("createProject", { input: { name: "Brand Refresh!", description: "Logo and palette", dueDate: "2026-12-01", color: "pink" } }, as(token));
      assert.equal(first.status, 200);
      assert.equal(first.data.id, "brand-refresh");
      assert.equal(first.data.color, "pink");
      assert.equal(first.data.status, "planning");
      assert.equal(first.data.dueDate, "2026-12-01");
      assert.deepEqual(first.data.members.map((m: Named) => m.name), ["Jordan Kim"]);

      const second = await t.call("createProject", { input: { name: "Brand Refresh" } }, as(token));
      assert.equal(second.status, 200);
      assert.notEqual(second.data.id, "brand-refresh");

      assert.equal((await t.call("auditLog", { action: "create_project", q: "Brand" }, as(token))).data.meta.total, 2);
    });

    it("validates input with message keys", async () => {
      const res = await t.call("createProject", { input: { name: "", dueDate: "tomorrow" } }, as(await jordan()));
      assert.equal(res.status, 422);
      assert.deepEqual(res.error?.fields, { name: "required", dueDate: "dateInvalid" });
    });

    it("rejects a value outside an enum before any resolver runs", async () => {
      const res = await t.call("createProject", { input: { name: "Colourful", color: "red" } }, as(await jordan()));
      assert.equal(res.http, 400);
      assert.equal(res.error?.code, "bad_request");
      assert.match(res.error!.message, /CategoricalColor/);
    });

    it("updates fields, can clear the due date, and moves the project to the top of recent activity", async () => {
      const token = await jordan();
      const res = await t.call("updateProject", { id: "design-system-audit", input: { name: "Design System Review", status: "active", dueDate: null } }, as(token));
      assert.equal(res.status, 200);
      assert.equal(res.data.name, "Design System Review");
      assert.equal(res.data.dueDate, null);
      assert.equal((await t.call("projects", {}, as(token))).data.data[0].id, "design-system-audit");

      assert.equal((await t.call("updateProject", { id: "nope", input: { name: "x" } }, as(token))).status, 404);
    });

    it("deletes a project together with its tasks", async () => {
      const token = await jordan();
      assert.equal((await t.call("deleteProject", { id: "website-redesign" }, as(token))).data, true);
      assert.equal((await t.call("project", { id: "website-redesign" }, as(token))).status, 404);
      assert.equal((await t.call("task", { id: "TASK-104" }, as(token))).status, 404);
      assert.equal((await t.call("deleteProject", { id: "website-redesign" }, as(token))).status, 404);
    });

    it("only lets owners and admins delete, and viewers not write at all", async () => {
      const jamie = await t.login(EMAIL.jamie);
      assert.equal((await t.call("deleteProject", { id: "website-redesign" }, as(jamie))).status, 403);

      // Make Jamie a viewer: read-only.
      const admin = await jordan();
      const id = (await t.call("adminUsers", { q: "jamie" }, as(admin))).data.data[0].id;
      await t.call("updateUser", { id, input: { role: "viewer" } }, as(admin));
      assert.equal((await t.call("projects", {}, as(jamie))).status, 200);
      assert.equal((await t.call("createProject", { input: { name: "Nope" } }, as(jamie))).status, 403);
      assert.equal((await t.call("addComment", { taskId: "TASK-104", body: "hi" }, as(jamie))).status, 403);
    });
  });

  describe("tasks", () => {
    it("lists tasks with the assignee, soonest due first and undated last", async () => {
      const res = await t.call("tasks", { projectId: "website-redesign" }, as(await jordan()));
      assert.equal(res.data.meta.total, 6);
      assert.deepEqual(res.data.data.map((x: Named) => x.id), ["TASK-104", "TASK-73", "TASK-98", "TASK-87", "TASK-121", "TASK-56"]);
      assert.deepEqual(res.data.data[0].assignee, { id: res.data.data[0].assignee.id, name: "Jamie Singh", initials: "JS" });
    });

    it("lists a project's tasks through the project, and 404s for an unknown one", async () => {
      const token = await jordan();
      assert.equal((await t.call("projectTasks", { id: "website-redesign" }, as(token))).data.meta.total, 6);
      assert.equal((await t.call("projectTasks", { id: "nope" }, as(token))).status, 404);
    });

    it("filters by assignee=me, status, priority and search (including by key)", async () => {
      const token = await jordan();
      const mine = await t.call("tasks", { assignee: "me" }, as(token));
      assert.equal(mine.data.meta.total, 6);
      assert.ok(mine.data.data.every((x: { assignee: Named }) => x.assignee.name === "Jordan Kim"));

      assert.equal((await t.call("tasks", { status: "done" }, as(token))).data.meta.total, 1);
      assert.equal((await t.call("tasks", { priority: "urgent" }, as(token))).data.meta.total, 1);
      assert.equal((await t.call("tasks", { q: "safari" }, as(token))).data.data[0].id, "TASK-104");
      assert.equal((await t.call("tasks", { q: "task-112" }, as(token))).data.data[0].id, "TASK-112");
      // A malformed assignee id matches nothing instead of erroring.
      assert.equal((await t.call("tasks", { assignee: "not-a-uuid" }, as(token))).data.meta.total, 0);
    });

    it("returns a task with its comments in order, and 404s on unknown or malformed keys", async () => {
      const token = await jordan();
      const res = await t.call("task", { id: "TASK-104" }, as(token));
      assert.equal(res.status, 200);
      assert.equal(res.data.comments.length, 2);
      assert.equal(res.data.comments[0].author.name, "Jordan Kim");
      assert.match(res.data.comments[1].body, /SameSite=Lax/);

      assert.equal((await t.call("task", { id: "TASK-99999" }, as(token))).status, 404);
      assert.equal((await t.call("task", { id: "banana" }, as(token))).status, 404);
    });

    it("creates a task with the next number, validating the project and the assignee", async () => {
      const token = await jordan();
      const jamieId = (await t.call("task", { id: "TASK-104" }, as(token))).data.assignee.id;
      const created = await t.call("createTask", { input: { projectId: "mobile-app-v2", title: "Plan beta", priority: "high", assigneeId: jamieId, dueDate: "2026-10-30" } }, as(token));
      assert.equal(created.status, 200);
      // Numbering continues after the highest seeded task.
      assert.equal(created.data.id, "TASK-223");
      assert.equal(created.data.status, "todo");
      assert.equal(created.data.assignee.name, "Jamie Singh");
      assert.deepEqual(created.data.comments, []);

      assert.equal((await t.call("createTask", { input: { projectId: "ghost", title: "x" } }, as(token))).status, 400);
      assert.equal((await t.call("createTask", { input: { projectId: "mobile-app-v2", title: "x", assigneeId: "nobody" } }, as(token))).status, 400);
      const invalid = await t.call("createTask", { input: { projectId: "mobile-app-v2", title: "" } }, as(token));
      assert.deepEqual(invalid.error?.fields, { title: "required" });
    });

    it("updates a task, including unassigning and clearing the due date, and updates progress", async () => {
      const token = await jordan();
      const res = await t.call("updateTask", { id: "TASK-87", input: { status: "done", assigneeId: null, dueDate: null, title: "Write the Q3 brief" } }, as(token));
      assert.equal(res.status, 200);
      assert.equal(res.data.status, "done");
      assert.equal(res.data.assignee, null);
      assert.equal(res.data.dueDate, null);
      assert.equal(res.data.title, "Write the Q3 brief");

      assert.equal((await t.call("project", { id: "website-redesign" }, as(token))).data.progress, 33); // 2 of 6
    });

    it("leaves a field alone when it is not sent", async () => {
      const token = await jordan();
      const before = (await t.call("task", { id: "TASK-87" }, as(token))).data;
      const res = await t.call("updateTask", { id: "TASK-87", input: { priority: "low" } }, as(token));
      assert.equal(res.data.priority, "low");
      assert.equal(res.data.title, before.title);
      assert.equal(res.data.dueDate, before.dueDate);
      assert.equal(res.data.assignee?.id, before.assignee?.id);
    });

    it("adds a comment as the signed-in user and deletes tasks with their comments", async () => {
      const token = await t.login(EMAIL.jamie);
      const res = await t.call("addComment", { taskId: "TASK-104", body: "Fixed in main." }, as(token));
      assert.equal(res.status, 200);
      assert.equal(res.data.author.name, "Jamie Singh");
      assert.equal((await t.call("task", { id: "TASK-104" }, as(token))).data.comments.length, 3);

      assert.equal((await t.call("addComment", { taskId: "TASK-104", body: "   " }, as(token))).status, 422);
      assert.equal((await t.call("deleteTask", { id: "TASK-104" }, as(token))).data, true);
      assert.equal((await t.call("task", { id: "TASK-104" }, as(token))).status, 404);
    });

    it("keeps a task's comments readable after its author is deleted", async () => {
      const admin = await jordan();
      const jamieId = (await t.call("adminUsers", { q: "jamie" }, as(admin))).data.data[0].id;
      assert.equal((await t.call("deleteUser", { id: jamieId }, as(admin))).data, true);
      const task = await t.call("task", { id: "TASK-104" }, as(admin));
      assert.equal(task.data.assignee, null);
      assert.equal(task.data.comments[1].author.name, "Deleted user");
    });
  });

  describe("dashboard", () => {
    it("returns the user, up to four recent non-archived projects, and their tasks", async () => {
      const res = await t.call("dashboard", {}, as(await jordan()));
      assert.equal(res.status, 200);
      const { me, recentProjects, myTasks } = res.data;
      assert.equal(me.email, EMAIL.jordan);
      assert.equal(recentProjects.length, 4);
      assert.ok(recentProjects.every((p: { status: string }) => p.status !== "archived"));
      assert.equal(myTasks.length, 6);
      assert.equal((await t.call("dashboard")).status, 401);
    });
  });

  describe("tenant isolation", () => {
    it("never shows or touches another organization's data", async () => {
      const outsider = as(await t.login(EMAIL.alex)); // admin of a different organization
      // Northwind has its own workspace, and none of Trestle's projects are in it.
      const own = await t.call("projects", {}, outsider);
      assert.deepEqual(own.data.data.map((p: Named) => p.id).sort(), ["northwind-checkout", "northwind-loyalty"]);
      assert.equal((await t.call("tasks", { projectId: "website-redesign" }, outsider)).data.meta.total, 0);
      assert.equal((await t.call("project", { id: "website-redesign" }, outsider)).status, 404);
      assert.equal((await t.call("updateProject", { id: "website-redesign", input: { name: "Hacked" } }, outsider)).status, 404);
      assert.equal((await t.call("deleteProject", { id: "website-redesign" }, outsider)).status, 404);
      assert.equal((await t.call("task", { id: "TASK-104" }, outsider)).status, 404);
      const ownTasks = await t.call("tasks", {}, outsider);
      assert.deepEqual(ownTasks.data.data.map((x: Named) => x.id).sort(), ["TASK-201", "TASK-202", "TASK-203", "TASK-204"]);
      assert.equal((await t.call("addComment", { taskId: "TASK-104", body: "hi" }, outsider)).status, 404);
      assert.equal((await t.call("updateTask", { id: "TASK-104", input: { status: "done" } }, outsider)).status, 404);
      assert.equal((await t.call("createTask", { input: { projectId: "website-redesign", title: "Sneaky" } }, outsider)).status, 400);
      assert.equal((await t.call("projectTasks", { id: "website-redesign" }, outsider)).status, 404);
    });

    it("refuses to assign a task to someone outside the organization", async () => {
      const token = await jordan();
      const alexId = (await t.call("adminUsers", { q: "alex.kim" }, as(token))).data.data[0].id;
      assert.equal((await t.call("updateTask", { id: "TASK-87", input: { assigneeId: alexId } }, as(token))).status, 400);
    });
  });

  describe("contact form", () => {
    it("stores a message without needing to sign in", async () => {
      const res = await t.call("sendContactMessage", { input: { name: "Pat", email: "Pat@Example.com", message: "Interested in Enterprise" } });
      assert.equal(res.data, true);
      const bad = await t.call("sendContactMessage", { input: { name: "", email: "nope", message: "" } });
      assert.deepEqual(bad.error?.fields, { name: "required", email: "emailInvalid", message: "required" });
    });
  });

  describe("plumbing", () => {
    it("reports health, 404s unknown routes in the error shape, and caps request bodies", async () => {
      const health = await t.app.request("/health");
      assert.deepEqual(await health.json(), { ok: true });
      const missing = await t.app.request("/api/nope");
      assert.equal(missing.status, 404);
      assert.equal(((await missing.json()) as { error: { code: string } }).error.code, "not_found");
      // The old REST paths are gone, and GraphQL is not served over GET.
      assert.equal((await t.app.request("/api/projects")).status, 404);
      assert.equal((await t.app.request("/api/graphql?query={me{id}}")).status, 404);

      const huge = await t.post(JSON.stringify({ query: "mutation { logout }", variables: { x: "x".repeat(1_200_000) } }));
      assert.equal(huge.http, 400);
    });

    it("marks every API response as uncacheable and sets the browser security headers", async () => {
      const token = await jordan();
      for (const options of [as(token), {}]) {
        const res = await t.call("projects", {}, options);
        assert.equal(res.headers.get("cache-control"), "private, no-store");
        assert.equal(res.headers.get("x-content-type-options"), "nosniff");
        assert.equal(res.headers.get("referrer-policy"), "no-referrer");
        assert.match(res.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
        assert.equal(res.headers.get("x-powered-by"), null);
      }
    });

    it("answers CORS preflight only for allowed origins", async () => {
      const cors = await setup({ corsOrigins: ["http://localhost:5173"] });
      const preflight = (origin: string) => cors.app.request("/api/graphql", { method: "OPTIONS", headers: { origin, "access-control-request-method": "POST" } });
      assert.equal((await preflight("http://localhost:5173")).headers.get("access-control-allow-origin"), "http://localhost:5173");
      assert.equal((await preflight("http://evil.test")).headers.get("access-control-allow-origin"), null);
      await cors.close();
    });
  });
});
