import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import { EMAIL, PASSWORD, setup } from "./test-utils";

// A stand-in for the admin panel's production build.
const dist = mkdtempSync(join(tmpdir(), "admin-dist-"));
mkdirSync(join(dist, "assets"));
writeFileSync(join(dist, "index.html"), "<!doctype html><title>Trestle Admin</title><script src=\"/assets/app.js\"></script>");
writeFileSync(join(dist, "assets", "app.js"), "console.log('admin')");
writeFileSync(join(dist, "theme-init.js"), "// theme");
writeFileSync(join(dist, "_headers"), "/*\n  X-Frame-Options: DENY\n  Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self'\n  Referrer-Policy: no-referrer\n");

describe("admin panel served by the API", async () => {
  const t = await setup({ adminDist: dist });
  after(() => t.close());

  const get = (path: string, headers: Record<string, string> = {}) => t.app.request(path, { headers });

  it("serves the app shell at the root and for client-side routes, with the panel's own headers", async () => {
    for (const path of ["/", "/users", "/organizations/anything"]) {
      const res = await get(path);
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get("content-type") ?? "", /text\/html/);
      assert.match(await res.text(), /Trestle Admin/);
      assert.equal(res.headers.get("cache-control"), "no-cache");
      assert.match(res.headers.get("content-security-policy-report-only") ?? "", /script-src 'self'/);
      assert.equal(res.headers.get("x-frame-options"), "DENY");
      // The API's deny-all policy would stop the panel from running, so it must not be on these pages.
      assert.equal(res.headers.get("content-security-policy"), null);
    }
  });

  it("serves fingerprinted assets as immutable and with the right type", async () => {
    const res = await get("/assets/app.js");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /javascript/);
    assert.equal(res.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal((await get("/theme-init.js")).headers.get("cache-control"), "no-cache");
  });

  it("404s a missing file instead of returning the app shell for it", async () => {
    assert.equal((await get("/assets/missing.js")).status, 404);
    assert.equal((await get("/nothing.css")).status, 404);
  });

  it("never serves files from outside the build folder", async () => {
    for (const path of ["/..%2f..%2fpackage.json", "/%2e%2e/%2e%2e/etc/passwd.txt", "/assets/..%2f..%2f..%2fpackage.json"]) {
      const res = await get(path);
      assert.ok(res.status === 404 || res.headers.get("content-type")?.includes("text/html"), `${path} -> ${res.status}`);
      assert.doesNotMatch(await res.text(), /"name"|root:/);
    }
  });

  it("leaves the API alone: JSON errors and its own strict headers", async () => {
    const res = await get("/api/nope");
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "not_found");
    assert.match(res.headers.get("content-security-policy") ?? "", /default-src 'none'/);
    assert.equal(res.headers.get("cache-control"), "private, no-store");
    assert.equal((await get("/health")).status, 200);
  });

  it("lets the panel write with its cookie from the API's own origin, and nothing else", async () => {
    const login = await t.app.request("http://admin.test/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-auth-mode": "cookie" },
      body: JSON.stringify({ email: EMAIL.jordan, password: PASSWORD }),
    });
    const cookie = /^([^=]+=[^;]+)/.exec(login.headers.get("set-cookie") ?? "")![1]!;
    const patch = (origin: string, extra: Record<string, string> = {}) =>
      t.app.request("http://admin.test/api/auth/me", {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie, origin, host: "admin.test", ...extra },
        body: JSON.stringify({ name: "Jordan Kim", email: EMAIL.jordan }),
      });

    assert.equal((await patch("http://admin.test")).status, 200);
    assert.equal((await patch("http://evil.test")).status, 403);
    // Behind a proxy the origin is what the proxy reports.
    assert.equal((await patch("https://admin.example", { "x-forwarded-host": "admin.example", "x-forwarded-proto": "https" })).status, 200);
    assert.equal((await patch("https://admin.example")).status, 403);
  });
});
