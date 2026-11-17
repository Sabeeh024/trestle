import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { sql } from "drizzle-orm";

import { EMAIL, PASSWORD, setup } from "./test-utils";

const ADMIN_ORIGIN = "http://admin.test";

type Session = { id: string; current: boolean; userAgent: string | null };

describe("sessions and passwords", async () => {
  const t = await setup({ corsOrigins: [ADMIN_ORIGIN] });
  beforeEach(() => t.reset());
  after(() => t.close());

  const me = (token: string) => t.call("me", {}, { token });
  const signIn = (email: string, password = PASSWORD, headers?: Record<string, string>) => t.call("login", { input: { email, password } }, headers ? { headers } : {});
  const changePassword = (token: string, input: object) => t.call("changePassword", { input }, { token });

  describe("change password", () => {
    it("needs the current password, and says which field is wrong", async () => {
      const token = await t.login(EMAIL.jamie);
      const wrong = await changePassword(token, { currentPassword: "not-it-at-all", newPassword: "a-new-password-1" });
      assert.equal(wrong.status, 422);
      assert.deepEqual(wrong.error?.fields, { currentPassword: "passwordIncorrect" });
      // Nothing changed.
      assert.equal((await signIn(EMAIL.jamie)).status, 200);
    });

    it("validates the new password", async () => {
      const token = await t.login(EMAIL.jamie);
      const short = await changePassword(token, { currentPassword: PASSWORD, newPassword: "short" });
      assert.deepEqual(short.error?.fields, { newPassword: "passwordTooShort" });
      const empty = await changePassword(token, {});
      assert.deepEqual(empty.error?.fields, { currentPassword: "required", newPassword: "required" });
    });

    it("sets the new password, keeps this session, and signs out every other device", async () => {
      const here = await t.login(EMAIL.jamie);
      const phone = await t.login(EMAIL.jamie);
      const res = await changePassword(here, { currentPassword: PASSWORD, newPassword: "a-new-password-1" });
      assert.equal(res.data, true);

      assert.equal((await me(here)).status, 200);
      assert.equal((await me(phone)).status, 401);
      assert.equal((await signIn(EMAIL.jamie)).status, 401);
      assert.equal((await signIn(EMAIL.jamie, "a-new-password-1")).status, 200);
    });

    it("cancels a pending reset link, since the account's password just changed", async () => {
      await t.call("forgotPassword", { input: { email: EMAIL.jamie } });
      const link = /token=([\w-]+)/.exec(t.mails[0]!.text)![1];
      const token = await t.login(EMAIL.jamie);
      await changePassword(token, { currentPassword: PASSWORD, newPassword: "a-new-password-1" });
      assert.equal((await t.call("resetPassword", { input: { token: link, password: "taken-over-123" } })).status, 400);
    });

    it("requires signing in", async () => {
      const res = await t.call("changePassword", { input: { currentPassword: PASSWORD, newPassword: "a-new-password-1" } });
      assert.equal(res.status, 401);
      assert.equal(res.http, 401);
    });
  });

  describe("session list", () => {
    it("lists this user's sessions with the current one marked, and records the client", async () => {
      const first = await t.login(EMAIL.jamie);
      const second = (await signIn(EMAIL.jamie, PASSWORD, { "user-agent": "Test Phone/1.0" })).data.token as string;
      await t.login(EMAIL.jordan);

      const list = await t.call("sessions", {}, { token: second });
      assert.equal(list.status, 200);
      const sessions = list.data as Session[];
      assert.equal(sessions.length, 2);
      assert.equal(sessions.filter((s) => s.current).length, 1);
      assert.equal(sessions.find((s) => s.current)!.userAgent, "Test Phone/1.0");
      assert.equal((await me(first)).status, 200);
    });

    it("cannot be asked for the token or its hash", async () => {
      const token = await t.login(EMAIL.jamie);
      const res = await t.post(JSON.stringify({ query: "{ sessions { id tokenHash token } }" }), { token });
      assert.equal(res.http, 400);
      assert.match(res.body.errors[0].message, /Cannot query field "tokenHash"/);
    });

    it("revokes one session, but only your own", async () => {
      const keep = await t.login(EMAIL.jamie);
      const other = await t.login(EMAIL.jamie);
      const target = ((await t.call("sessions", {}, { token: keep })).data as Session[]).find((s) => !s.current)!;

      assert.equal((await t.call("revokeSession", { id: target.id }, { token: keep })).data, true);
      assert.equal((await me(other)).status, 401);
      assert.equal((await me(keep)).status, 200);
      assert.equal((await t.call("revokeSession", { id: target.id }, { token: keep })).status, 404);

      const jordan = await t.login(EMAIL.jordan);
      const jordansId = ((await t.call("sessions", {}, { token: jordan })).data as Session[])[0]!.id;
      assert.equal((await t.call("revokeSession", { id: jordansId }, { token: keep })).status, 404);
      assert.equal((await me(jordan)).status, 200);
      assert.equal((await t.call("revokeSession", { id: "not-a-uuid" }, { token: keep })).status, 404);
    });

    it("signs out every other device in one go", async () => {
      const here = await t.login(EMAIL.jamie);
      const a = await t.login(EMAIL.jamie);
      const b = await t.login(EMAIL.jamie);
      assert.equal((await t.call("revokeOtherSessions", {}, { token: here })).data, true);
      assert.equal((await me(here)).status, 200);
      assert.equal((await me(a)).status, 401);
      assert.equal((await me(b)).status, 401);
      assert.equal((await t.call("sessions", {}, { token: here })).data.length, 1);
    });

    it("revoking the current session signs it out", async () => {
      const token = await t.login(EMAIL.jamie);
      const id = (await t.call("sessions", {}, { token })).data[0].id;
      assert.equal((await t.call("revokeSession", { id }, { token })).data, true);
      assert.equal((await me(token)).status, 401);
    });

    it("does not list expired sessions", async () => {
      const token = await t.login(EMAIL.jamie);
      await t.login(EMAIL.jamie);
      const before = (await t.call("sessions", {}, { token })).data as Session[];
      assert.equal(before.length, 2);

      await t.db.execute(sql`update sessions set expires_at = now() - interval '1 minute' where id = ${before.find((s) => !s.current)!.id}`);
      assert.equal((await t.call("sessions", {}, { token })).data.length, 1);
    });
  });

  describe("cookie sessions (for browser apps without a server)", () => {
    const cookieLogin = (headers: Record<string, string> = {}) =>
      t.call("login", { input: { email: EMAIL.jordan, password: PASSWORD } }, { headers: { "x-auth-mode": "cookie", ...headers } });
    const cookieOf = (res: { headers: Headers }) => /^([^=]+=[^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1] ?? "";
    /** An operation sent the way the admin panel sends it: by cookie, from a page on `origin`. */
    const asBrowser = (cookie: string, origin: string | undefined, extra: Record<string, string> = {}) => ({ headers: { cookie, ...(origin ? { origin } : {}), ...extra } });

    it("sets an HttpOnly, Lax cookie and keeps the token out of the response", async () => {
      const res = await cookieLogin();
      assert.equal(res.status, 200);
      assert.equal(res.data.token, null);
      assert.equal(res.data.user.email, EMAIL.jordan);

      const setCookie = res.headers.get("set-cookie")!;
      assert.match(setCookie, /^trestle_session=/);
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=Lax/);
      assert.match(setCookie, /Max-Age=2592000/);
      assert.ok(!/Secure/.test(setCookie), "not Secure over plain HTTP in development");
      assert.ok(!/Domain=/i.test(setCookie));
    });

    it("still returns the token to clients that do not ask for a cookie", async () => {
      const res = await signIn(EMAIL.jordan);
      assert.ok(res.data.token);
      assert.equal(res.headers.get("set-cookie"), null);
    });

    it("authenticates later requests from the cookie", async () => {
      const cookie = cookieOf(await cookieLogin());
      const res = await t.call("me", {}, asBrowser(cookie, ADMIN_ORIGIN));
      assert.equal(res.status, 200);
      assert.equal(res.data.email, EMAIL.jordan);
      assert.equal((await t.call("me")).status, 401);
    });

    it("refuses a cookie request from another origin, or one the browser marks cross-site", async () => {
      const cookie = cookieOf(await cookieLogin());
      const rename = (origin: string, extra?: Record<string, string>) =>
        t.call("updateProfile", { input: { name: "Hacked", email: EMAIL.jordan } }, asBrowser(cookie, origin, extra));

      const evil = await rename("http://evil.test");
      assert.equal(evil.status, 403);
      assert.equal(evil.http, 403);
      assert.equal((await rename(ADMIN_ORIGIN, { "sec-fetch-site": "cross-site" })).status, 403);
      assert.equal((await rename(ADMIN_ORIGIN, { "sec-fetch-site": "same-site" })).status, 200);
      // Every operation is a POST, so reads are checked as well: a page on another site cannot read with the cookie.
      assert.equal((await t.call("me", {}, asBrowser(cookie, "http://evil.test"))).status, 403);
    });

    it("lets a bearer token win over a cookie, and does not apply the origin check to it", async () => {
      const cookie = cookieOf(await cookieLogin());
      const token = await t.login(EMAIL.jamie);
      const res = await t.call("me", {}, { token, headers: { cookie } });
      assert.equal(res.data.email, EMAIL.jamie);
      const created = await t.call("createProject", { input: { name: "From a server" } }, { token, headers: { origin: "http://elsewhere.test" } });
      assert.equal(created.status, 200);
      assert.equal(created.data.name, "From a server");
    });

    it("signs out on the server and clears the cookie", async () => {
      const cookie = cookieOf(await cookieLogin());
      const out = await t.call("logout", {}, asBrowser(cookie, ADMIN_ORIGIN));
      assert.equal(out.data, true);
      assert.match(out.headers.get("set-cookie")!, /Max-Age=0/);
      assert.equal((await t.call("me", {}, asBrowser(cookie, ADMIN_ORIGIN))).status, 401);
    });

    it("allows credentialed cross-origin calls from allowed origins only", async () => {
      const preflight = (origin: string) =>
        t.app.request("/api/graphql", { method: "OPTIONS", headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type,x-auth-mode" } });
      const ok = await preflight(ADMIN_ORIGIN);
      assert.equal(ok.headers.get("access-control-allow-origin"), ADMIN_ORIGIN);
      assert.equal(ok.headers.get("access-control-allow-credentials"), "true");
      assert.match(ok.headers.get("access-control-allow-headers") ?? "", /x-auth-mode/i);
      assert.equal((await preflight("http://evil.test")).headers.get("access-control-allow-origin"), null);
    });

    it("uses the __Host- prefix and Secure in production", async () => {
      const prod = await setup({ secureCookies: true });
      const res = await prod.call("login", { input: { email: EMAIL.jordan, password: PASSWORD } }, { headers: { "x-auth-mode": "cookie" } });
      const setCookie = res.headers.get("set-cookie")!;
      assert.match(setCookie, /^__Host-trestle_session=/);
      assert.match(setCookie, /Secure/);
      assert.match(setCookie, /Path=\//);
      await prod.close();
    });
  });
});
