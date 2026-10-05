import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadConfig } from "./config";
import { setup } from "./test-utils";

describe("configuration", () => {
  it("has working defaults for local development", () => {
    const config = loadConfig({});
    assert.equal(config.NODE_ENV, "development");
    assert.equal(config.DB_PREPARE, "1");
    assert.equal(config.TRUST_PROXY, 0);
    assert.equal(config.APP_VERSION, undefined);
    assert.match(config.CORS_ORIGINS, /localhost:5173/);
  });

  it("allows no other browser origins in production unless told to", () => {
    assert.equal(loadConfig({ NODE_ENV: "production" }).CORS_ORIGINS, "");
    assert.equal(loadConfig({ NODE_ENV: "production", CORS_ORIGINS: "https://a.example,https://b.example" }).CORS_ORIGINS, "https://a.example,https://b.example");
  });

  it("reads hosted-database and deployment settings", () => {
    const config = loadConfig({ DB_PREPARE: "0", APP_VERSION: "abc123", TRUST_PROXY: "2", INTERNAL_API_KEY: "a-long-enough-shared-key", ADMIN_DIST: "/app/admin" });
    assert.equal(config.DB_PREPARE, "0");
    assert.equal(config.APP_VERSION, "abc123");
    assert.equal(config.TRUST_PROXY, 2);
    assert.equal(config.ADMIN_DIST, "/app/admin");
  });

  it("rejects values that would silently weaken or break the setup", () => {
    assert.throws(() => loadConfig({ DB_PREPARE: "maybe" }));
    assert.throws(() => loadConfig({ INTERNAL_API_KEY: "short" }));
    assert.throws(() => loadConfig({ NODE_ENV: "production", DEV_SSO: "1" }), /DEV_SSO/);
  });
});

describe("health", async () => {
  it("reports the running version, so a deploy can prove the new build is live", async () => {
    const versioned = await setup({ version: "3f2a9c1" });
    assert.deepEqual((await versioned.request("GET", "/health")).body, { ok: true, version: "3f2a9c1" });
    await versioned.close();

    const plain = await setup();
    assert.deepEqual((await plain.request("GET", "/health")).body, { ok: true });
    await plain.close();
  });
});
