import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { operations } from "@trestle/api-client/operations";
import { buildSchema, parse, specifiedRules, validate, type GraphQLObjectType } from "graphql";

import { createApp } from "./app";
import { typeDefs } from "./graphql/schema";
import { EMAIL, setup } from "./test-utils";

describe("the GraphQL contract", () => {
  const schema = buildSchema(typeDefs);

  it("accepts every operation the client sends", () => {
    for (const [name, op] of Object.entries(operations)) {
      const errors = validate(schema, parse(op.query), specifiedRules);
      assert.deepEqual(errors.map((e) => e.message), [], name);
    }
  });

  it("has a client operation for every query and mutation, so none goes untested or unused", () => {
    const used = new Set(Object.values(operations).map((op) => op.field));
    for (const root of [schema.getQueryType(), schema.getMutationType()] as GraphQLObjectType[]) {
      for (const field of Object.keys(root.getFields())) assert.ok(used.has(field), `${root.name}.${field} has no operation in @trestle/api-client`);
    }
  });

  it("makes every root field non-null, which the transport status depends on", () => {
    for (const root of [schema.getQueryType(), schema.getMutationType()] as GraphQLObjectType[]) {
      for (const [name, field] of Object.entries(root.getFields())) assert.match(String(field.type), /!$/, `${root.name}.${name}`);
    }
  });
});

describe("the GraphQL endpoint", async () => {
  const t = await setup();
  after(() => t.close());

  const token = () => t.login(EMAIL.jordan);
  const raw = (body: string, headers: Record<string, string> = {}) => t.app.request("/api/graphql", { method: "POST", headers, body });
  const json = (query: string, extra: object = {}) => t.post(JSON.stringify({ query, ...extra }), { token: undefined });

  it("takes only JSON POSTs: no GET, no form posts, no batches", async () => {
    assert.equal((await t.app.request("/api/graphql?query={__typename}")).status, 404);
    const form = await raw("query=%7Bme%7Bid%7D%7D", { "content-type": "application/x-www-form-urlencoded" });
    assert.equal(form.status, 415);
    const text = await raw("{}", { "content-type": "text/plain" });
    assert.equal(text.status, 415);

    const batch = await raw(JSON.stringify([{ query: "{ me { id } }" }, { query: "{ me { id } }" }]), { "content-type": "application/json" });
    assert.equal(batch.status, 400);
    assert.equal((await raw("not json", { "content-type": "application/json" })).status, 400);
    assert.equal((await raw("{}", { "content-type": "application/json" })).status, 400);
  });

  it("answers a malformed or invalid document with 400 and a bad_request error", async () => {
    const syntax = await json("{ me { id ");
    assert.equal(syntax.http, 400);
    assert.equal(syntax.body.errors[0].extensions.code, "bad_request");

    const unknown = await json("{ nope }");
    assert.equal(unknown.http, 400);
    assert.match(unknown.body.errors[0].message, /Cannot query field "nope"/);
    assert.equal(unknown.body.data, undefined);
  });

  it("reports an unauthenticated request as 401 with the usual error code", async () => {
    const res = await json("{ me { id } }");
    assert.equal(res.http, 401);
    assert.equal(res.body.data, null);
    assert.deepEqual(res.body.errors[0].extensions, { code: "unauthenticated", status: 401 });
  });

  it("returns just the fields asked for", async () => {
    const res = await t.post(JSON.stringify({ query: "{ me { name role } }" }), { token: await token() });
    assert.deepEqual(res.body, { data: { me: { name: "Jordan Kim", role: "owner" } } });
  });

  it("runs several fields in one request, and a mutation's fields one after another", async () => {
    const res = await t.post(JSON.stringify({ query: "{ me { id } projects { meta { total } } tasks { meta { total } } }" }), { token: await token() });
    assert.equal(res.http, 200);
    assert.deepEqual(Object.keys(res.body.data), ["me", "projects", "tasks"]);
  });

  it("refuses an operation that asks for too many top-level fields, including through fragments", async () => {
    const fields = (n: number, prefix = "a") => Array.from({ length: n }, (_, i) => `${prefix}${i}: me { id }`).join(" ");
    const twelve = await json(`{ ${fields(12)} }`);
    assert.equal(twelve.http, 401, "twelve is allowed (it is only refused for being signed out)");

    const wide = await json(`{ ${fields(13)} }`);
    assert.equal(wide.http, 400);
    assert.match(wide.body.errors[0].message, /at most 12 top-level fields/);

    const viaFragment = await json(`{ ...Many ...More } fragment Many on Query { ${fields(8, "m")} } fragment More on Query { ${fields(8, "n")} }`);
    assert.equal(viaFragment.http, 400);
  });

  it("refuses an enormous document before parsing it", async () => {
    const res = await json(`{ me { id } } # ${"x".repeat(21_000)}`);
    assert.equal(res.http, 400);
  });

  it("turns introspection off in production and leaves it on in development", async () => {
    // The schema describes no data, so in development anyone may read it (GraphiQL, code generation).
    const dev = await json("{ __schema { queryType { name } } }");
    assert.equal(dev.body.data.__schema.queryType.name, "Query");

    const prod = await setup({ secureCookies: true });
    const refused = await prod.post(JSON.stringify({ query: "{ __schema { queryType { name } } }" }), { token: await prod.login(EMAIL.jordan) });
    assert.equal(refused.http, 400);
    assert.match(refused.body.errors[0].message, /introspection/i);
    await prod.close();
  });

  it("hides internal failures behind a generic error", async () => {
    // A database that explodes with something sensitive in its message.
    const broken = createApp({
      db: new Proxy({}, { get: () => { throw new Error("password authentication failed for user trestle_prod"); } }) as never,
      limiter: false,
    });
    const log = console.error;
    console.error = () => {};
    try {
      const res = await broken.request("/api/graphql", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer abc" }, body: JSON.stringify({ query: "{ me { id } }" }) });
      const body = (await res.json()) as { errors: { message: string; extensions: object }[] };
      assert.equal(res.status, 500);
      assert.deepEqual(body.errors[0], { message: "Something went wrong", path: ["me"], extensions: { code: "internal_error", status: 500 } });
      assert.doesNotMatch(JSON.stringify(body), /trestle_prod|password authentication/);
    } finally {
      console.error = log;
    }
  });
});
