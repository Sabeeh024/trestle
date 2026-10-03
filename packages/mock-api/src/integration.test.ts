// Exercises @trestle/api-client against the real server over HTTP, so the client's URLs,
// query strings and response unwrapping are checked against what the mock API actually returns.
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";

import { serve } from "@hono/node-server";
import { createApi, createApiClient, isApiError } from "@trestle/api-client";
import { createQueries, queryKeys } from "@trestle/api-client/query";
import { QueryClient } from "@tanstack/react-query";

import { createApp } from "./app";
import { Db } from "./db";

const db = new Db();
let server: ReturnType<typeof serve>;
let api: ReturnType<typeof createApi>;

before(async () => {
  server = serve({ fetch: createApp({ db }).fetch, port: 0 });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  api = createApi(createApiClient({ baseURL: `http://localhost:${port}` }));
});

after(() => server.close());
beforeEach(() => db.reset());

describe("api over HTTP", () => {
  it("unwraps single resources and keeps pagination on lists", async () => {
    const project = await api.projects.get("website-redesign");
    assert.equal(project.members.length, 3);

    const page = await api.projects.list({ status: "active", pageSize: 2 });
    assert.equal(page.data.length, 2);
    assert.equal(page.meta.total, 4);
  });

  it("sends filters as query params and skips undefined ones", async () => {
    const mine = await api.tasks.list({ assignee: "me", status: undefined });
    assert.ok(mine.data.length > 0);
    assert.ok(mine.data.every((t) => t.assignee?.name === "Jordan Kim"));
  });

  it("surfaces API errors as ApiError", async () => {
    await assert.rejects(api.projects.get("nope"), (error: unknown) => isApiError(error) && error.status === 404 && error.code === "not_found");
    await assert.rejects(api.auth.login({ email: "jordan.kim@trestle.io", password: "wrong" }), (error: unknown) => isApiError(error) && error.status === 401);
  });

  it("runs mutations with and without response bodies", async () => {
    const task = await api.tasks.create({ projectId: "website-redesign", title: "Ship it", priority: "high" });
    assert.equal(task.status, "todo");

    const comment = await api.tasks.addComment(task.id, "Looks good");
    assert.equal(comment.body, "Looks good");

    await api.tasks.remove(task.id);
    await assert.rejects(api.tasks.get(task.id), (error: unknown) => isApiError(error) && error.status === 404);
  });

  it("covers the admin endpoints", async () => {
    const users = await api.admin.users.list({ q: "northwind", sort: "name", direction: "desc" });
    assert.deepEqual(users.data.map((u) => u.name), ["Elena Cho", "Alex Kim"]);

    const suspended = await api.admin.users.suspend("usr_000001");
    assert.equal(suspended.status, "suspended");
    assert.deepEqual(await api.admin.users.bulk({ action: "suspend", ids: ["usr_000002"] }), { affected: 1 });

    const log = await api.admin.auditLog.list({ action: "suspend_user" });
    assert.equal(log.data[0]?.actor, "jordan.kim@trestle.io");
  });
});

describe("query options", () => {
  it("fetches through a QueryClient and caches under the exported keys", async () => {
    const queryClient = new QueryClient();
    const queries = createQueries(api);

    const dashboard = await queryClient.fetchQuery(queries.dashboard());
    assert.equal(dashboard.me.name, "Jordan Kim");
    assert.deepEqual(queryClient.getQueryData(queryKeys.dashboard), dashboard);

    const list = await queryClient.fetchQuery(queries.projects.list({ q: "mobile" }));
    assert.equal(list.data[0]?.id, "mobile-app-v2");
    assert.deepEqual(queryClient.getQueryData(queryKeys.projects.list({ q: "mobile" })), list);
  });
});
