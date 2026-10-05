import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { createApp } from "./app";
import { clientIp } from "./lib/rate-limit";
import { EMAIL, PASSWORD, setup } from "./test-utils";

describe("rate limiting", async () => {
  // limiter: undefined turns the real, database-backed limiter on.
  const t = await setup({ limiter: undefined });
  beforeEach(() => t.reset());
  after(() => t.close());

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) => t.request("POST", path, { body, headers });
  const login = (password: string, headers?: Record<string, string>) => post("/api/auth/login", { email: EMAIL.jordan, password }, headers);

  it("blocks a client after ten failed sign-ins, even with the right password", async () => {
    for (let i = 0; i < 10; i++) assert.equal((await login("not-the-password")).status, 401);
    const blocked = await login(PASSWORD);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error.code, "rate_limited");
  });

  it("cannot be bypassed by changing X-Forwarded-For when no proxy is trusted", async () => {
    for (let i = 0; i < 10; i++) await login("not-the-password", { "x-forwarded-for": `203.0.113.${i}` });
    assert.equal((await login(PASSWORD, { "x-forwarded-for": "198.51.100.77" })).status, 429);
  });

  it("limits one account across many clients", async () => {
    // 30 per account regardless of address; each request here comes from a different "proxy-reported" address.
    const behindProxy = await setup({ limiter: undefined, config: { TRUST_PROXY: 1 } });
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await behindProxy.request("POST", "/api/auth/login", { body: { email: EMAIL.jordan, password: "nope-nope" }, headers: { "x-forwarded-for": `192.0.2.${i}` } })).status;
    assert.equal(last, 429);
    await behindProxy.close();
  });

  it("reads the client address from the right end of X-Forwarded-For only as far as proxies are trusted", () => {
    const ctx = (xff: string) => ({ req: { header: (name: string) => (name === "x-forwarded-for" ? xff : undefined) } }) as never;
    // The left entries are whatever the client claimed; the right ones were added by our proxies.
    assert.equal(clientIp(ctx("6.6.6.6, 10.0.0.9, 203.0.113.5"), 1), "203.0.113.5");
    assert.equal(clientIp(ctx("6.6.6.6, 10.0.0.9, 203.0.113.5"), 2), "10.0.0.9");
    assert.equal(clientIp(ctx("6.6.6.6, 203.0.113.5"), 0), "unknown");
  });

  it("shares counters between API instances on the same database", async () => {
    const second = createApp({ db: t.db, mailer: { send: async () => {} } });
    for (let i = 0; i < 10; i++) await login("not-the-password");
    const res = await second.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL.jordan, password: PASSWORD }) });
    assert.equal(res.status, 429);
  });

  it("limits password-reset emails per address, and answers the same for unknown addresses", async () => {
    for (let i = 0; i < 3; i++) assert.equal((await post("/api/auth/forgot-password", { email: EMAIL.jamie })).status, 204);
    assert.equal(t.mails.length, 3);
    assert.equal((await post("/api/auth/forgot-password", { email: EMAIL.jamie })).status, 429);
    assert.equal(t.mails.length, 3);

    for (let i = 0; i < 3; i++) assert.equal((await post("/api/auth/forgot-password", { email: "ghost@nowhere.dev" })).status, 204);
    assert.equal((await post("/api/auth/forgot-password", { email: "ghost@nowhere.dev" })).status, 429);
  });

  it("limits sign-ups, contact messages and reset attempts per client", async () => {
    for (let i = 0; i < 10; i++) assert.equal((await post("/api/auth/signup", { name: `P${i}`, email: `p${i}@example.com`, password: "longenough1" })).status, 201);
    assert.equal((await post("/api/auth/signup", { name: "P", email: "extra@example.com", password: "longenough1" })).status, 429);

    for (let i = 0; i < 10; i++) assert.equal((await post("/api/contact", { name: "A", email: "a@b.co", message: "hi" })).status, 201);
    assert.equal((await post("/api/contact", { name: "A", email: "a@b.co", message: "hi" })).status, 429);

    for (let i = 0; i < 20; i++) assert.equal((await post("/api/auth/reset-password", { token: "x", password: "longenough1" })).status, 400);
    assert.equal((await post("/api/auth/reset-password", { token: "x", password: "longenough1" })).status, 429);
  });

  it("starts a new window once the old one has expired", async () => {
    for (let i = 0; i < 10; i++) await login("not-the-password");
    assert.equal((await login(PASSWORD)).status, 429);
    await t.db.execute((await import("drizzle-orm")).sql`update rate_limits set reset_at = now() - interval '1 second'`);
    assert.equal((await login(PASSWORD)).status, 200);
  });

  it("accepts CSP reports without signing in", async () => {
    const res = await t.app.request("/api/csp-report", { method: "POST", headers: { "content-type": "application/csp-report" }, body: JSON.stringify({ "csp-report": { "violated-directive": "script-src" } }) });
    assert.equal(res.status, 204);
  });
});
