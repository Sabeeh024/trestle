import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { sql } from "drizzle-orm";

import { EMAIL, PASSWORD, setup, tokenFromMail } from "./test-utils";

describe("auth", async () => {
  const t = await setup();
  before(() => t.reset());
  beforeEach(() => t.reset());
  after(() => t.close());

  const login = (email: string, password: string) => t.call("login", { input: { email, password } });
  const me = (token?: string) => t.call("me", {}, token ? { token } : {});

  it("signs in with the right password and returns the user", async () => {
    const res = await login(EMAIL.jordan, PASSWORD);
    assert.equal(res.status, 200);
    assert.equal(res.data.user.email, EMAIL.jordan);
    assert.equal(res.data.user.role, "owner");
    assert.equal(res.data.user.initials, "JK");
    assert.equal(res.data.user.orgName, "Trestle Labs");
    assert.ok(res.data.token.length > 20);
    assert.equal("passwordHash" in res.data.user, false);
  });

  it("matches the email case-insensitively", async () => {
    assert.equal((await login("JORDAN.KIM@Trestle.io", PASSWORD)).status, 200);
  });

  it("rejects a wrong password and an unknown email the same way, and records the failure", async () => {
    const wrong = await login(EMAIL.jordan, "nope-nope");
    const unknown = await login("ghost@nowhere.dev", PASSWORD);
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.error, unknown.error);
    assert.equal(wrong.error?.code, "invalid_credentials");

    const admin = await t.login(EMAIL.jordan);
    const log = await t.call("auditLog", { action: "login_failed" }, { token: admin });
    assert.ok(log.data.data.length >= 2);
  });

  it("refuses suspended accounts and invited accounts that have no password yet", async () => {
    const suspended = await login(EMAIL.tom, PASSWORD);
    assert.equal(suspended.status, 403);
    assert.equal(suspended.error?.code, "account_suspended");

    assert.equal((await login(EMAIL.sam, PASSWORD)).status, 401);
  });

  it("reports missing fields with message keys", async () => {
    const res = await t.call("login", { input: {} });
    assert.equal(res.status, 422);
    assert.deepEqual(res.error?.fields, { email: "required", password: "required" });
  });

  it("requires a valid token, and a token stops working after logout", async () => {
    assert.equal((await me()).status, 401);
    assert.equal((await me("garbage")).status, 401);

    const token = await t.login(EMAIL.jordan);
    assert.equal((await me(token)).data.email, EMAIL.jordan);
    assert.equal((await t.call("logout", {}, { token })).data, true);
    assert.equal((await me(token)).status, 401);
  });

  it("signs up into a new trial workspace as its owner", async () => {
    const res = await t.call("signup", { input: { name: "Rita Okafor", email: "Rita@Example.com", password: "longenough1" } });
    assert.equal(res.status, 200);
    const { user, token } = res.data;
    assert.equal(user.email, "rita@example.com");
    assert.equal(user.role, "owner");
    assert.equal(user.orgName, "Rita Okafor's workspace");

    assert.equal((await me(token)).data.id, user.id);
    // Their workspace is empty and private.
    assert.equal((await t.call("projects", {}, { token })).data.meta.total, 0);

    // A second person with the same name gets their own workspace rather than failing.
    const twin = await t.call("signup", { input: { name: "Rita Okafor", email: "rita2@example.com", password: "longenough1" } });
    assert.equal(twin.status, 200);
    assert.notEqual(twin.data.user.orgId, user.orgId);
  });

  it("rejects a taken email and a short password on signup", async () => {
    const taken = await t.call("signup", { input: { name: "X", email: EMAIL.jordan.toUpperCase(), password: "longenough1" } });
    assert.equal(taken.status, 422);
    assert.deepEqual(taken.error?.fields, { email: "emailTaken" });

    const short = await t.call("signup", { input: { name: "X", email: "x@y.dev", password: "short" } });
    assert.deepEqual(short.error?.fields, { password: "passwordTooShort" });
  });

  it("updates the profile and refuses an email that belongs to someone else", async () => {
    const token = await t.login(EMAIL.jamie);
    const ok = await t.call("updateProfile", { input: { name: "Jamie S. Singh", email: EMAIL.jamie } }, { token });
    assert.equal(ok.data.name, "Jamie S. Singh");
    assert.equal(ok.data.initials, "JS");

    const taken = await t.call("updateProfile", { input: { name: "Jamie", email: EMAIL.jordan } }, { token });
    assert.equal(taken.status, 422);
    assert.deepEqual(taken.error?.fields, { email: "emailTaken" });
  });

  it("refuses SSO unless the organization is enterprise, and unless an identity provider is configured", async () => {
    const free = await t.call("sso", { input: { email: EMAIL.maya } });
    assert.equal(free.status, 403);
    assert.equal(free.error?.code, "sso_not_enabled");

    const enterprise = await t.call("sso", { input: { email: EMAIL.jordan } });
    assert.equal(enterprise.status, 501);
    assert.equal(enterprise.error?.code, "sso_not_configured");
  });

  it("lets enterprise users in through SSO only when DEV_SSO is on", async () => {
    const dev = await setup({ config: { DEV_SSO: "1" } });
    const res = await dev.call("sso", { input: { email: EMAIL.jordan } });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.email, EMAIL.jordan);
    await dev.close();
  });

  describe("password reset", () => {
    const forgot = (email: string) => t.call("forgotPassword", { input: { email } });

    it("answers true whether or not the address has an account, and only emails real ones", async () => {
      assert.equal((await forgot("ghost@nowhere.dev")).data, true);
      assert.equal(t.mails.length, 0);
      assert.equal((await forgot(EMAIL.jordan)).data, true);
      assert.equal(t.mails.length, 1);
      assert.equal(t.mails[0]!.to, EMAIL.jordan);
    });

    it("sets a new password from the emailed link, once, and signs out other devices", async () => {
      const oldSession = await t.login(EMAIL.jordan);
      await forgot(EMAIL.jordan);
      const token = tokenFromMail(t.mails[0]);
      assert.ok(token);

      const done = await t.call("resetPassword", { input: { token, password: "a-brand-new-one" } });
      assert.equal(done.data, true);
      assert.equal((await me(oldSession)).status, 401);
      assert.equal((await login(EMAIL.jordan, PASSWORD)).status, 401);
      assert.equal((await login(EMAIL.jordan, "a-brand-new-one")).status, 200);

      const again = await t.call("resetPassword", { input: { token, password: "another-password" } });
      assert.equal(again.status, 400);
      assert.equal(again.error?.code, "invalid_token");
    });

    it("rejects an expired or unknown link and a short password", async () => {
      assert.equal((await t.call("resetPassword", { input: { token: "nope", password: "long-enough-1" } })).status, 400);
      await forgot(EMAIL.jordan);
      const token = tokenFromMail(t.mails[0]);
      const short = await t.call("resetPassword", { input: { token, password: "short" } });
      assert.deepEqual(short.error?.fields, { password: "passwordTooShort" });

      await t.db.execute(sql`update password_resets set expires_at = now() - interval '1 minute'`);
      const expired = await t.call("resetPassword", { input: { token, password: "long-enough-1" } });
      assert.equal(expired.status, 400);
    });

    it("activates an invited account when its password is set", async () => {
      const admin = await t.login(EMAIL.jordan);
      await t.call("inviteUser", { input: { email: "new.hire@trestle.io", orgId: (await me(admin)).data.orgId } }, { token: admin });
      const token = tokenFromMail(t.mails.at(-1));
      assert.equal((await t.call("resetPassword", { input: { token, password: "welcome-aboard-1" } })).data, true);
      const res = await login("new.hire@trestle.io", "welcome-aboard-1");
      assert.equal(res.status, 200);
      assert.equal(res.data.user.status, "active");
    });
  });

  it("suspending a user signs them out immediately", async () => {
    const admin = await t.login(EMAIL.jordan);
    const jamie = await t.login(EMAIL.jamie);
    assert.equal((await me(jamie)).status, 200);

    const users = await t.call("adminUsers", { q: "jamie" }, { token: admin });
    assert.equal((await t.call("suspendUser", { id: users.data.data[0].id }, { token: admin })).status, 200);
    assert.equal((await me(jamie)).status, 401);
  });
});
