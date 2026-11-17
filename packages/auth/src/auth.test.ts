import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeClient } from "./client";
import { readCookie, serializeSessionCookie, sessionCookieName, sessionCookieOptions } from "./cookie";
import { nextHeaders, securityHeaders } from "./headers";
import { bearerToken, clientHeadersForApi, isTrustedWrite } from "./request";

describe("session cookie", () => {
  it("uses the __Host- prefix only when secure", () => {
    assert.equal(sessionCookieName(true), "__Host-trestle_session");
    assert.equal(sessionCookieName(false), "trestle_session");
  });

  it("is HttpOnly, Lax, site-wide and lasts as long as the server session", () => {
    assert.deepEqual(sessionCookieOptions({ secure: true, ttlDays: 30 }), { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 2_592_000 });
  });

  it("serializes a cookie that a __Host- prefix accepts, and one that deletes it", () => {
    const options = sessionCookieOptions({ secure: true, ttlDays: 1 });
    const set = serializeSessionCookie("__Host-trestle_session", "abc", options);
    assert.match(set, /^__Host-trestle_session=abc; Path=\/; HttpOnly; SameSite=Lax; Secure; Max-Age=86400$/);
    assert.ok(!/Domain=/i.test(set), "a __Host- cookie must not set Domain");
    assert.match(serializeSessionCookie("__Host-trestle_session", "", options), /Max-Age=0$/);
    assert.ok(!/Secure/.test(serializeSessionCookie("trestle_session", "abc", sessionCookieOptions({ secure: false, ttlDays: 1 }))));
  });

  it("reads one cookie out of a header", () => {
    assert.equal(readCookie("a=1; trestle_session=tok; b=2", "trestle_session"), "tok");
    assert.equal(readCookie("a=1", "trestle_session"), undefined);
    assert.equal(readCookie("trestle_session=", "trestle_session"), undefined);
    assert.equal(readCookie(undefined, "x"), undefined);
    // A cookie whose name merely ends the same way is not the one.
    assert.equal(readCookie("x_trestle_session=bad", "trestle_session"), undefined);
  });
});

describe("request checks", () => {
  const allowed = ["https://admin.example.com"];
  const write = (over: object) => ({ method: "POST", origin: undefined, fetchSite: undefined, ...over });

  it("reads bearer tokens", () => {
    assert.equal(bearerToken("Bearer abc "), "abc");
    assert.equal(bearerToken("Basic abc"), undefined);
    assert.equal(bearerToken("Bearer "), undefined);
    assert.equal(bearerToken(null), undefined);
  });

  it("lets reads through whatever their origin", () => {
    assert.equal(isTrustedWrite(write({ method: "GET", origin: "https://evil.test", fetchSite: "cross-site" }), allowed), true);
  });

  it("accepts writes from an allowed origin and refuses every other", () => {
    assert.equal(isTrustedWrite(write({ origin: "https://admin.example.com", fetchSite: "same-site" }), allowed), true);
    assert.equal(isTrustedWrite(write({ origin: "https://evil.test", fetchSite: "same-site" }), allowed), false);
    assert.equal(isTrustedWrite(write({ origin: "https://admin.example.com.evil.test" }), allowed), false);
  });

  it("refuses a write the browser marks cross-site, even from an allowed origin", () => {
    assert.equal(isTrustedWrite(write({ origin: "https://admin.example.com", fetchSite: "cross-site" }), allowed), false);
  });

  it("accepts a write with no browser headers (not a browser) but not one marked same-site without an origin", () => {
    assert.equal(isTrustedWrite(write({}), allowed), true);
    assert.equal(isTrustedWrite(write({ fetchSite: "same-origin" }), allowed), true);
    assert.equal(isTrustedWrite(write({ fetchSite: "same-site" }), allowed), false);
  });
});

describe("clientHeadersForApi", () => {
  const incoming = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });

  it("passes the visitor's address, browser and the shared key", () => {
    assert.deepEqual(clientHeadersForApi(incoming({ "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "Mozilla/5.0" }), "k"), {
      "x-internal-key": "k",
      "x-client-ip": "203.0.113.9",
      "User-Agent": "Mozilla/5.0",
    });
    assert.equal(clientHeadersForApi(incoming({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "1.1.1.1" }), "k")["x-client-ip"], "198.51.100.2");
  });

  it("sends the browser name but not the address without a key, because an unproven claim is worthless", () => {
    assert.deepEqual(clientHeadersForApi(incoming({ "x-forwarded-for": "203.0.113.9", "user-agent": "Mozilla/5.0" }), undefined), { "User-Agent": "Mozilla/5.0" });
    assert.deepEqual(clientHeadersForApi(incoming({ "x-forwarded-for": "203.0.113.9" }), undefined), {});
  });
});

describe("security headers", () => {
  it("adds HSTS only on request, and honours the referrer policy", () => {
    assert.equal("Strict-Transport-Security" in securityHeaders(), false);
    assert.match(securityHeaders({ hsts: true })["Strict-Transport-Security"]!, /max-age=63072000/);
    assert.equal(securityHeaders({ referrerPolicy: "no-referrer" })["Referrer-Policy"], "no-referrer");
    assert.ok(nextHeaders().every((h) => typeof h.key === "string" && typeof h.value === "string"));
  });
});

describe("describeClient", () => {
  it("names the browser and system, and degrades gracefully", () => {
    assert.equal(describeClient("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"), "Chrome on Windows");
    assert.equal(describeClient("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0"), "Edge on Windows");
    assert.equal(describeClient("Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile Safari/604.1"), "Safari on iOS");
    assert.equal(describeClient("curl/8.4.0"), "curl/8.4.0");
    assert.equal(describeClient(null), "Unknown device");
  });
});
