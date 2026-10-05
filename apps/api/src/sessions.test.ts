import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { sql } from "drizzle-orm";

import { EMAIL, PASSWORD, setup } from "./test-utils";

const ADMIN_ORIGIN = "http://admin.test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (res: Response): Promise<any> => res.json();

describe("sessions and passwords", async () => {
  const t = await setup({ corsOrigins: [ADMIN_ORIGIN] });
  beforeEach(() => t.reset());
  after(() => t.close());

  const me = (token: string) => t.request("GET", "/api/auth/me", { token });

  describe("change password", () => {
    it("needs the current password, and says which field is wrong", async () => {
      const token = await t.login(EMAIL.jamie);
      const wrong = await t.request("POST", "/api/auth/change-password", { token, body: { currentPassword: "not-it-at-all", newPassword: "a-new-password-1" } });
      assert.equal(wrong.status, 422);
      assert.deepEqual(wrong.body.error.fields, { currentPassword: "passwordIncorrect" });
      // Nothing changed.
      assert.equal((await t.request("POST", "/api/auth/login", { body: { email: EMAIL.jamie, password: PASSWORD } })).status, 200);
    });

    it("validates the new password", async () => {
      const token = await t.login(EMAIL.jamie);
      const short = await t.request("POST", "/api/auth/change-password", { token, body: { currentPassword: PASSWORD, newPassword: "short" } });
      assert.deepEqual(short.body.error.fields, { newPassword: "passwordTooShort" });
      const empty = await t.request("POST", "/api/auth/change-password", { token, body: {} });
      assert.deepEqual(empty.body.error.fields, { currentPassword: "required", newPassword: "required" });
    });

    it("sets the new password, keeps this session, and signs out every other device", async () => {
      const here = await t.login(EMAIL.jamie);
      const phone = await t.login(EMAIL.jamie);
      const res = await t.request("POST", "/api/auth/change-password", { token: here, body: { currentPassword: PASSWORD, newPassword: "a-new-password-1" } });
      assert.equal(res.status, 204);

      assert.equal((await me(here)).status, 200);
      assert.equal((await me(phone)).status, 401);
      assert.equal((await t.request("POST", "/api/auth/login", { body: { email: EMAIL.jamie, password: PASSWORD } })).status, 401);
      assert.equal((await t.request("POST", "/api/auth/login", { body: { email: EMAIL.jamie, password: "a-new-password-1" } })).status, 200);
    });

    it("cancels a pending reset link, since the account's password just changed", async () => {
      await t.request("POST", "/api/auth/forgot-password", { body: { email: EMAIL.jamie } });
      const link = /token=([\w-]+)/.exec(t.mails[0]!.text)![1];
      const token = await t.login(EMAIL.jamie);
      await t.request("POST", "/api/auth/change-password", { token, body: { currentPassword: PASSWORD, newPassword: "a-new-password-1" } });
      assert.equal((await t.request("POST", "/api/auth/reset-password", { body: { token: link, password: "taken-over-123" } })).status, 400);
    });

    it("requires signing in", async () => {
      assert.equal((await t.request("POST", "/api/auth/change-password", { body: { currentPassword: PASSWORD, newPassword: "a-new-password-1" } })).status, 401);
    });
  });

  describe("session list", () => {
    it("lists this user's sessions with the current one marked, and records the client", async () => {
      const first = await t.login(EMAIL.jamie);
      const second = (await t.request("POST", "/api/auth/login", { body: { email: EMAIL.jamie, password: PASSWORD }, headers: { "user-agent": "Test Phone/1.0" } })).body.data.token as string;
      await t.login(EMAIL.jordan);

      const list = await t.request("GET", "/api/auth/sessions", { token: second });
      assert.equal(list.status, 200);
      assert.equal(list.body.data.length, 2);
      assert.equal(list.body.data.filter((s: { current: boolean }) => s.current).length, 1);
      const current = list.body.data.find((s: { current: boolean }) => s.current);
      assert.equal(current.userAgent, "Test Phone/1.0");
      assert.ok(!("tokenHash" in current) && !("token" in current));
      assert.equal((await me(first)).status, 200);
    });

    it("revokes one session, but only your own", async () => {
      const keep = await t.login(EMAIL.jamie);
      const other = await t.login(EMAIL.jamie);
      const list = await t.request("GET", "/api/auth/sessions", { token: keep });
      const target = list.body.data.find((s: { current: boolean }) => !s.current);

      assert.equal((await t.request("DELETE", `/api/auth/sessions/${target.id}`, { token: keep })).status, 204);
      assert.equal((await me(other)).status, 401);
      assert.equal((await me(keep)).status, 200);
      assert.equal((await t.request("DELETE", `/api/auth/sessions/${target.id}`, { token: keep })).status, 404);

      const jordan = await t.login(EMAIL.jordan);
      const jordansId = (await t.request("GET", "/api/auth/sessions", { token: jordan })).body.data[0].id;
      assert.equal((await t.request("DELETE", `/api/auth/sessions/${jordansId}`, { token: keep })).status, 404);
      assert.equal((await me(jordan)).status, 200);
      assert.equal((await t.request("DELETE", "/api/auth/sessions/not-a-uuid", { token: keep })).status, 404);
    });

    it("signs out every other device in one go", async () => {
      const here = await t.login(EMAIL.jamie);
      const a = await t.login(EMAIL.jamie);
      const b = await t.login(EMAIL.jamie);
      assert.equal((await t.request("DELETE", "/api/auth/sessions", { token: here })).status, 204);
      assert.equal((await me(here)).status, 200);
      assert.equal((await me(a)).status, 401);
      assert.equal((await me(b)).status, 401);
      assert.equal((await t.request("GET", "/api/auth/sessions", { token: here })).body.data.length, 1);
    });

    it("revoking the current session signs it out", async () => {
      const token = await t.login(EMAIL.jamie);
      const id = (await t.request("GET", "/api/auth/sessions", { token })).body.data[0].id;
      assert.equal((await t.request("DELETE", `/api/auth/sessions/${id}`, { token })).status, 204);
      assert.equal((await me(token)).status, 401);
    });

    it("does not list expired sessions", async () => {
      const token = await t.login(EMAIL.jamie);
      await t.login(EMAIL.jamie);
      const before = await t.request("GET", "/api/auth/sessions", { token });
      assert.equal(before.body.data.length, 2);

      const other = before.body.data.find((s: { current: boolean }) => !s.current).id;
      await t.db.execute(sql`update sessions set expires_at = now() - interval '1 minute' where id = ${other}`);
      assert.equal((await t.request("GET", "/api/auth/sessions", { token })).body.data.length, 1);
    });
  });

  describe("cookie sessions (for browser apps without a server)", () => {
    const cookieLogin = (headers: Record<string, string> = {}) =>
      t.app.request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-auth-mode": "cookie", ...headers },
        body: JSON.stringify({ email: EMAIL.jordan, password: PASSWORD }),
      });
    const cookieOf = (res: Response) => /^([^=]+=[^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1] ?? "";
    const withCookie = (cookie: string, init: RequestInit & { origin?: string } = {}) => {
      const { origin, ...rest } = init;
      return { ...rest, headers: { cookie, ...(origin ? { origin } : {}), ...(rest.headers ?? {}) } };
    };

    it("sets an HttpOnly, Lax cookie and keeps the token out of the response", async () => {
      const res = await cookieLogin();
      assert.equal(res.status, 200);
      const body = await json(res);
      assert.equal(body.data.token, null);
      assert.equal(body.data.user.email, EMAIL.jordan);

      const setCookie = res.headers.get("set-cookie")!;
      assert.match(setCookie, /^trestle_session=/);
      assert.match(setCookie, /HttpOnly/);
      assert.match(setCookie, /SameSite=Lax/);
      assert.match(setCookie, /Max-Age=2592000/);
      assert.ok(!/Secure/.test(setCookie), "not Secure over plain HTTP in development");
      assert.ok(!/Domain=/i.test(setCookie));
    });

    it("still returns the token to clients that do not ask for a cookie", async () => {
      const res = await t.request("POST", "/api/auth/login", { body: { email: EMAIL.jordan, password: PASSWORD } });
      assert.ok(res.body.data.token);
      assert.equal((await t.app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL.jordan, password: PASSWORD }) })).headers.get("set-cookie"), null);
    });

    it("authenticates later requests from the cookie", async () => {
      const cookie = cookieOf(await cookieLogin());
      const res = await t.app.request("/api/auth/me", withCookie(cookie, { origin: ADMIN_ORIGIN }));
      assert.equal(res.status, 200);
      assert.equal((await json(res)).data.email, EMAIL.jordan);
      assert.equal((await t.app.request("/api/auth/me")).status, 401);
    });

    it("refuses a cookie write from another origin, or one the browser marks cross-site", async () => {
      const cookie = cookieOf(await cookieLogin());
      const patch = (init: { origin?: string; headers?: Record<string, string> }) =>
        t.app.request("/api/auth/me", withCookie(cookie, { method: "PATCH", body: JSON.stringify({ name: "Hacked", email: EMAIL.jordan }), ...init, headers: { "content-type": "application/json", ...init.headers } }));

      assert.equal((await patch({ origin: "http://evil.test" })).status, 403);
      assert.equal((await patch({ origin: ADMIN_ORIGIN, headers: { "sec-fetch-site": "cross-site" } })).status, 403);
      assert.equal((await patch({ origin: ADMIN_ORIGIN, headers: { "sec-fetch-site": "same-site" } })).status, 200);
      // Reads are not writes: any origin may ask, and CORS decides who can read the answer.
      assert.equal((await t.app.request("/api/auth/me", withCookie(cookie, { origin: "http://evil.test" }))).status, 200);
    });

    it("lets a bearer token win over a cookie, and does not apply the origin check to it", async () => {
      const cookie = cookieOf(await cookieLogin());
      const token = await t.login(EMAIL.jamie);
      const res = await t.app.request("/api/auth/me", { headers: { cookie, authorization: `Bearer ${token}` } });
      assert.equal((await json(res)).data.email, EMAIL.jamie);
      assert.equal((await t.request("POST", "/api/projects", { token, body: { name: "From a server" }, headers: { origin: "http://elsewhere.test" } })).status, 201);
    });

    it("signs out on the server and clears the cookie", async () => {
      const cookie = cookieOf(await cookieLogin());
      const out = await t.app.request("/api/auth/logout", withCookie(cookie, { method: "POST", origin: ADMIN_ORIGIN }));
      assert.equal(out.status, 204);
      assert.match(out.headers.get("set-cookie")!, /Max-Age=0/);
      assert.equal((await t.app.request("/api/auth/me", withCookie(cookie, { origin: ADMIN_ORIGIN }))).status, 401);
    });

    it("allows credentialed cross-origin calls from allowed origins only", async () => {
      const ok = await t.app.request("/api/auth/me", { method: "OPTIONS", headers: { origin: ADMIN_ORIGIN, "access-control-request-method": "GET", "access-control-request-headers": "x-auth-mode" } });
      assert.equal(ok.headers.get("access-control-allow-origin"), ADMIN_ORIGIN);
      assert.equal(ok.headers.get("access-control-allow-credentials"), "true");
      assert.match(ok.headers.get("access-control-allow-headers") ?? "", /x-auth-mode/i);
      const no = await t.app.request("/api/auth/me", { method: "OPTIONS", headers: { origin: "http://evil.test", "access-control-request-method": "GET" } });
      assert.equal(no.headers.get("access-control-allow-origin"), null);
    });

    it("uses the __Host- prefix and Secure in production", async () => {
      const prod = await setup({ secureCookies: true });
      const res = await prod.app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-auth-mode": "cookie" }, body: JSON.stringify({ email: EMAIL.jordan, password: PASSWORD }) });
      const setCookie = res.headers.get("set-cookie")!;
      assert.match(setCookie, /^__Host-trestle_session=/);
      assert.match(setCookie, /Secure/);
      assert.match(setCookie, /Path=\//);
      await prod.close();
    });
  });
});
