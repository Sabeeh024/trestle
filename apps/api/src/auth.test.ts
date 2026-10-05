import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { EMAIL, PASSWORD, setup, tokenFromMail } from "./test-utils";

describe("auth", async () => {
  const t = await setup();
  before(() => t.reset());
  beforeEach(() => t.reset());
  after(() => t.close());

  it("signs in with the right password and returns the user", async () => {
    const res = await t.request("POST", "/api/auth/login", { body: { email: EMAIL.jordan, password: PASSWORD } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, EMAIL.jordan);
    assert.equal(res.body.data.user.role, "owner");
    assert.equal(res.body.data.user.initials, "JK");
    assert.equal(res.body.data.user.orgName, "Trestle Labs");
    assert.ok(res.body.data.token.length > 20);
    assert.equal("passwordHash" in res.body.data.user, false);
  });

  it("matches the email case-insensitively", async () => {
    const res = await t.request("POST", "/api/auth/login", { body: { email: "JORDAN.KIM@Trestle.io", password: PASSWORD } });
    assert.equal(res.status, 200);
  });

  it("rejects a wrong password and an unknown email the same way, and records the failure", async () => {
    const wrong = await t.request("POST", "/api/auth/login", { body: { email: EMAIL.jordan, password: "nope-nope" } });
    const unknown = await t.request("POST", "/api/auth/login", { body: { email: "ghost@nowhere.dev", password: PASSWORD } });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
    assert.equal(wrong.body.error.code, "invalid_credentials");

    const admin = await t.login(EMAIL.jordan);
    const log = await t.request("GET", "/api/admin/audit-log?action=login_failed", { token: admin });
    assert.ok(log.body.data.length >= 2);
  });

  it("refuses suspended accounts and invited accounts that have no password yet", async () => {
    const suspended = await t.request("POST", "/api/auth/login", { body: { email: EMAIL.tom, password: PASSWORD } });
    assert.equal(suspended.status, 403);
    assert.equal(suspended.body.error.code, "account_suspended");

    const invited = await t.request("POST", "/api/auth/login", { body: { email: EMAIL.sam, password: PASSWORD } });
    assert.equal(invited.status, 401);
  });

  it("reports missing fields with message keys", async () => {
    const res = await t.request("POST", "/api/auth/login", { body: {} });
    assert.equal(res.status, 422);
    assert.deepEqual(res.body.error.fields, { email: "required", password: "required" });
  });

  it("requires a valid token, and a token stops working after logout", async () => {
    assert.equal((await t.request("GET", "/api/auth/me")).status, 401);
    assert.equal((await t.request("GET", "/api/auth/me", { token: "garbage" })).status, 401);

    const token = await t.login(EMAIL.jordan);
    assert.equal((await t.request("GET", "/api/auth/me", { token })).body.data.email, EMAIL.jordan);
    assert.equal((await t.request("POST", "/api/auth/logout", { token })).status, 204);
    assert.equal((await t.request("GET", "/api/auth/me", { token })).status, 401);
  });

  it("signs up into a new trial workspace as its owner", async () => {
    const res = await t.request("POST", "/api/auth/signup", { body: { name: "Rita Okafor", email: "Rita@Example.com", password: "longenough1" } });
    assert.equal(res.status, 201);
    const { user, token } = res.body.data;
    assert.equal(user.email, "rita@example.com");
    assert.equal(user.role, "owner");
    assert.equal(user.orgName, "Rita Okafor's workspace");

    const me = await t.request("GET", "/api/auth/me", { token });
    assert.equal(me.body.data.id, user.id);
    // Their workspace is empty and private.
    assert.equal((await t.request("GET", "/api/projects", { token })).body.meta.total, 0);

    // A second person with the same name gets their own workspace rather than failing.
    const twin = await t.request("POST", "/api/auth/signup", { body: { name: "Rita Okafor", email: "rita2@example.com", password: "longenough1" } });
    assert.equal(twin.status, 201);
    assert.notEqual(twin.body.data.user.orgId, user.orgId);
  });

  it("rejects a taken email and a short password on signup", async () => {
    const taken = await t.request("POST", "/api/auth/signup", { body: { name: "X", email: EMAIL.jordan.toUpperCase(), password: "longenough1" } });
    assert.equal(taken.status, 422);
    assert.deepEqual(taken.body.error.fields, { email: "emailTaken" });

    const short = await t.request("POST", "/api/auth/signup", { body: { name: "X", email: "x@y.dev", password: "short" } });
    assert.deepEqual(short.body.error.fields, { password: "passwordTooShort" });
  });

  it("updates the profile and refuses an email that belongs to someone else", async () => {
    const token = await t.login(EMAIL.jamie);
    const ok = await t.request("PATCH", "/api/auth/me", { token, body: { name: "Jamie S. Singh", email: EMAIL.jamie } });
    assert.equal(ok.body.data.name, "Jamie S. Singh");
    assert.equal(ok.body.data.initials, "JS");

    const taken = await t.request("PATCH", "/api/auth/me", { token, body: { name: "Jamie", email: EMAIL.jordan } });
    assert.equal(taken.status, 422);
    assert.deepEqual(taken.body.error.fields, { email: "emailTaken" });
  });

  it("refuses SSO unless the organization is enterprise, and unless an identity provider is configured", async () => {
    const free = await t.request("POST", "/api/auth/sso", { body: { email: EMAIL.maya } });
    assert.equal(free.status, 403);
    assert.equal(free.body.error.code, "sso_not_enabled");

    const enterprise = await t.request("POST", "/api/auth/sso", { body: { email: EMAIL.jordan } });
    assert.equal(enterprise.status, 501);
    assert.equal(enterprise.body.error.code, "sso_not_configured");
  });

  it("lets enterprise users in through SSO only when DEV_SSO is on", async () => {
    const dev = await setup({ config: { DEV_SSO: "1" } });
    const res = await dev.request("POST", "/api/auth/sso", { body: { email: EMAIL.jordan } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, EMAIL.jordan);
    await dev.close();
  });

  describe("password reset", () => {
    it("answers 204 whether or not the address has an account, and only emails real ones", async () => {
      assert.equal((await t.request("POST", "/api/auth/forgot-password", { body: { email: "ghost@nowhere.dev" } })).status, 204);
      assert.equal(t.mails.length, 0);
      assert.equal((await t.request("POST", "/api/auth/forgot-password", { body: { email: EMAIL.jordan } })).status, 204);
      assert.equal(t.mails.length, 1);
      assert.equal(t.mails[0]!.to, EMAIL.jordan);
    });

    it("sets a new password from the emailed link, once, and signs out other devices", async () => {
      const oldSession = await t.login(EMAIL.jordan);
      await t.request("POST", "/api/auth/forgot-password", { body: { email: EMAIL.jordan } });
      const token = tokenFromMail(t.mails[0]);
      assert.ok(token);

      const done = await t.request("POST", "/api/auth/reset-password", { body: { token, password: "a-brand-new-one" } });
      assert.equal(done.status, 204);
      assert.equal((await t.request("GET", "/api/auth/me", { token: oldSession })).status, 401);
      assert.equal((await t.request("POST", "/api/auth/login", { body: { email: EMAIL.jordan, password: PASSWORD } })).status, 401);
      assert.equal((await t.request("POST", "/api/auth/login", { body: { email: EMAIL.jordan, password: "a-brand-new-one" } })).status, 200);

      const again = await t.request("POST", "/api/auth/reset-password", { body: { token, password: "another-password" } });
      assert.equal(again.status, 400);
      assert.equal(again.body.error.code, "invalid_token");
    });

    it("rejects an expired or unknown link and a short password", async () => {
      assert.equal((await t.request("POST", "/api/auth/reset-password", { body: { token: "nope", password: "long-enough-1" } })).status, 400);
      await t.request("POST", "/api/auth/forgot-password", { body: { email: EMAIL.jordan } });
      const token = tokenFromMail(t.mails[0]);
      const short = await t.request("POST", "/api/auth/reset-password", { body: { token, password: "short" } });
      assert.deepEqual(short.body.error.fields, { password: "passwordTooShort" });

      await t.db.execute((await import("drizzle-orm")).sql`update password_resets set expires_at = now() - interval '1 minute'`);
      const expired = await t.request("POST", "/api/auth/reset-password", { body: { token, password: "long-enough-1" } });
      assert.equal(expired.status, 400);
    });

    it("activates an invited account when its password is set", async () => {
      const admin = await t.login(EMAIL.jordan);
      await t.request("POST", "/api/admin/users/invite", { token: admin, body: { email: "new.hire@trestle.io", orgId: (await t.request("GET", "/api/auth/me", { token: admin })).body.data.orgId } });
      const token = tokenFromMail(t.mails.at(-1));
      assert.equal((await t.request("POST", "/api/auth/reset-password", { body: { token, password: "welcome-aboard-1" } })).status, 204);
      const res = await t.request("POST", "/api/auth/login", { body: { email: "new.hire@trestle.io", password: "welcome-aboard-1" } });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.user.status, "active");
    });
  });

  it("suspending a user signs them out immediately", async () => {
    const admin = await t.login(EMAIL.jordan);
    const jamie = await t.login(EMAIL.jamie);
    assert.equal((await t.request("GET", "/api/auth/me", { token: jamie })).status, 200);

    const users = await t.request("GET", `/api/admin/users?q=jamie`, { token: admin });
    const id = users.body.data[0].id;
    assert.equal((await t.request("POST", `/api/admin/users/${id}/suspend`, { token: admin })).status, 200);
    assert.equal((await t.request("GET", "/api/auth/me", { token: jamie })).status, 401);
  });
});
