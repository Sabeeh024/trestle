import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createApi, GRAPHQL_PATH } from "./api";
import { isApiError } from "./errors";
import { operations } from "./operations";
import type { RequestConfig, Transport } from "./transport";

function fakeTransport(respond: (config: RequestConfig) => unknown) {
  const sent: RequestConfig[] = [];
  const transport: Transport = {
    async request<T>(config: RequestConfig) {
      sent.push(config);
      return respond(config) as T;
    },
  };
  return { transport, sent };
}

describe("createApi", () => {
  it("posts one named operation to the GraphQL endpoint and returns its root field", async () => {
    const { transport, sent } = fakeTransport(() => ({ data: { project: { id: "p1" } } }));
    const project = await createApi(transport).projects.get("p1");

    assert.deepEqual(project, { id: "p1" });
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.method, "POST");
    assert.equal(sent[0]!.url, GRAPHQL_PATH);
    assert.deepEqual(sent[0]!.body, { query: operations.project.query, operationName: "Project", variables: { id: "p1" } });
  });

  it("passes filters as variables, and passes the caller's request options through", async () => {
    const { transport, sent } = fakeTransport(() => ({ data: { projects: { data: [], meta: { page: 1, pageSize: 20, total: 0 } } } }));
    const signal = new AbortController().signal;
    await createApi(transport).projects.list({ q: "a b", status: "active", page: 2 }, { signal });

    assert.deepEqual((sent[0]!.body as { variables: unknown }).variables, { q: "a b", status: "active", page: 2 });
    assert.equal(sent[0]!.signal, signal);
  });

  it("sends mutation input under `input`, and maps method arguments onto the operation's variables", async () => {
    const { transport, sent } = fakeTransport(() => ({ data: { updateTask: {}, addComment: {}, updateUser: {} } }));
    const api = createApi(transport);
    await api.tasks.update("TASK-1", { assigneeId: null });
    await api.tasks.addComment("TASK-1", "hi");
    await api.admin.users.changeRole("u1", "admin");

    const variables = sent.map((s) => (s.body as { variables: unknown }).variables);
    assert.deepEqual(variables, [{ id: "TASK-1", input: { assigneeId: null } }, { taskId: "TASK-1", body: "hi" }, { id: "u1", input: { role: "admin" } }]);
  });

  it("turns a GraphQL error into an ApiError with the code, status and field messages the API reported", async () => {
    const { transport } = fakeTransport(() => ({
      data: null,
      errors: [{ message: "Some fields are invalid", extensions: { code: "validation_failed", status: 422, fields: { email: "emailInvalid" } } }],
    }));
    await assert.rejects(createApi(transport).auth.login({ email: "x", password: "y" }), (error: unknown) => {
      assert.ok(isApiError(error));
      assert.equal(error.status, 422);
      assert.equal(error.code, "validation_failed");
      assert.deepEqual(error.fields, { email: "emailInvalid" });
      return true;
    });
  });

  it("resolves operations that only confirm without returning anything", async () => {
    const { transport } = fakeTransport(() => ({ data: { logout: true } }));
    assert.equal(await createApi(transport).auth.logout(), undefined);
  });
});

describe("operations", () => {
  it("names each operation after its key's document, and reads the root field from it", () => {
    assert.equal(operations.login.name, "Login");
    assert.equal(operations.login.field, "login");
    assert.equal(operations.adminUsers.field, "adminUsers");
    assert.equal(operations.logout.field, "logout");
  });

  it("includes each fragment a document uses exactly once, and no others", () => {
    for (const [key, op] of Object.entries(operations)) {
      const defined = [...op.query.matchAll(/^fragment (\w+) on/gm)].map((m) => m[1]);
      assert.equal(new Set(defined).size, defined.length, `${key} repeats a fragment`);
      const spread = new Set([...op.query.matchAll(/\.\.\.(\w+)/g)].map((m) => m[1]));
      assert.deepEqual([...spread].sort(), [...defined].sort(), key);
    }
  });
});
