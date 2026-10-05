// Exercises @trestle/api-client against the real server over HTTP, once per transport, so the client's
// URLs, query strings and response unwrapping are checked against what this API returns, and the fetch
// and axios transports are held to identical behaviour.
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, it } from "node:test";

import { serve } from "@hono/node-server";
import { QueryClient } from "@tanstack/react-query";
import { createApi, isApiError, type Transport } from "@trestle/api-client";
import { createAxiosTransport } from "@trestle/api-client/axios";
import { createFetchTransport } from "@trestle/api-client/fetch";
import { createQueries, queryKeys } from "@trestle/api-client/query";
import { sql } from "drizzle-orm";

import { EMAIL, PASSWORD, setup } from "./test-utils";

describe("api client over HTTP", async () => {
  const t = await setup();
  let server: ReturnType<typeof serve>;
  let baseURL: string;
  let token: string;

  before(async () => {
    server = serve({ fetch: t.app.fetch, port: 0 });
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseURL = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    await t.reset();
    token = await t.login(EMAIL.jordan);
  });
  after(async () => {
    server.close();
    await t.close();
  });

  const transports: Record<string, () => Transport> = {
    fetch: () => createFetchTransport({ baseURL, getToken: () => token }),
    axios: () => createAxiosTransport({ baseURL, getToken: () => token }),
  };

  for (const [name, makeTransport] of Object.entries(transports)) {
    describe(name, () => {
      const getApi = () => createApi(makeTransport());

      it("unwraps single resources and keeps pagination on lists", async () => {
        const api = getApi();
        const project = await api.projects.get("website-redesign");
        assert.equal(project.members.length, 2);

        const page = await api.projects.list({ status: "active", pageSize: 2 });
        assert.equal(page.data.length, 2);
        assert.equal(page.meta.total, 4);
      });

      it("sends filters as query params and skips undefined ones", async () => {
        const mine = await getApi().tasks.list({ assignee: "me", status: undefined });
        assert.ok(mine.data.length > 0);
        assert.ok(mine.data.every((x) => x.assignee?.name === "Jordan Kim"));
      });

      it("surfaces API errors as ApiError", async () => {
        const api = getApi();
        await assert.rejects(api.projects.get("nope"), (error: unknown) => isApiError(error) && error.status === 404 && error.code === "not_found");
        await assert.rejects(
          api.auth.login({ email: EMAIL.jordan, password: "not-the-password" }),
          (error: unknown) => isApiError(error) && error.status === 401,
        );
      });

      it("runs mutations with and without response bodies", async () => {
        const api = getApi();
        const task = await api.tasks.create({ projectId: "website-redesign", title: "Ship it", priority: "high" });
        assert.equal(task.status, "todo");

        const comment = await api.tasks.addComment(task.id, "Looks good");
        assert.equal(comment.body, "Looks good");

        await api.tasks.remove(task.id);
        await assert.rejects(api.tasks.get(task.id), (error: unknown) => isApiError(error) && error.status === 404);
      });

      it("signs in, reads the profile with the token and signs out", async () => {
        const api = createApi(createFetchTransport({ baseURL }));
        const session = await api.auth.login({ email: EMAIL.jamie, password: PASSWORD });
        const authed = createApi(createFetchTransport({ baseURL, getToken: () => session.token }));
        assert.equal((await authed.auth.me()).email, EMAIL.jamie);
        await authed.auth.logout();
        await assert.rejects(authed.auth.me(), (error: unknown) => isApiError(error) && error.status === 401);
      });

      it("covers the admin endpoints", async () => {
        const api = getApi();
        const users = await api.admin.users.list({ q: "northwind", sort: "name", direction: "desc" });
        assert.deepEqual(users.data.map((u) => u.name), ["Elena Cho", "Alex Kim"]);

        const suspended = await api.admin.users.suspend(users.data[1]!.id);
        assert.equal(suspended.status, "suspended");
        assert.deepEqual(await api.admin.users.bulk({ action: "suspend", ids: [users.data[0]!.id] }), { affected: 1 });

        const log = await api.admin.auditLog.list({ action: "suspend_user" });
        assert.equal(log.data[0]?.actor, EMAIL.jordan);
      });

      it("sends a contact message, which the server answers with an empty 201", async () => {
        await getApi().contact.send({ name: "Dana", email: "dana@example.com", message: "Hello" });
        const stored = (await t.db.execute(sql`select count(*)::int as n from contact_messages`)) as unknown as { rows?: { n: number }[] } | { n: number }[];
        assert.equal((Array.isArray(stored) ? stored : stored.rows)![0]!.n, 1);
        await assert.rejects(
          getApi().contact.send({ name: "", email: "nope", message: "" }),
          (error: unknown) => isApiError(error) && error.status === 422 && error.fields?.email === "emailInvalid",
        );
      });

      it("fetches through a QueryClient and caches under the exported keys", async () => {
        const queryClient = new QueryClient();
        const queries = createQueries(getApi());

        const dashboard = await queryClient.fetchQuery(queries.dashboard());
        assert.equal(dashboard.me.name, "Jordan Kim");
        assert.deepEqual(queryClient.getQueryData(queryKeys.dashboard), dashboard);

        const list = await queryClient.fetchQuery(queries.projects.list({ q: "mobile" }));
        assert.equal(list.data[0]?.id, "mobile-app-v2");
        assert.deepEqual(queryClient.getQueryData(queryKeys.projects.list({ q: "mobile" })), list);
      });
    });
  }
});
