import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isApiError, type ApiError } from "../errors";
import { createFetchTransport, type FetchTransportOptions } from "./fetch";

interface Call {
  url: string;
  init: RequestInit & { next?: unknown };
}

function transportWith(handler: (call: Call) => Response | Promise<Response>, options: Partial<FetchTransportOptions> = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: URL, init: Call["init"]) => {
    const call = { url: url.toString(), init };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { calls, transport: createFetchTransport({ baseURL: "http://api.test", fetch: fetchImpl, ...options }) };
}

// Like real fetch: rejects at once if the signal is already aborted, otherwise when it aborts.
const untilAborted = ({ init }: Call) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init.signal;
    if (signal?.aborted) return reject(signal.reason);
    signal?.addEventListener("abort", () => reject(signal.reason));
  });

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createFetchTransport", () => {
  it("sends the bearer token, awaiting async token sources", async () => {
    const { calls, transport } = transportWith(() => json(200, {}), { getToken: async () => "abc" });
    await transport.request({ method: "GET", url: "/api/projects" });
    assert.equal(new Headers(calls[0]?.init.headers).get("Authorization"), "Bearer abc");
  });

  it("sends no Authorization header without a token", async () => {
    const { calls, transport } = transportWith(() => json(200, {}), { getToken: () => null });
    await transport.request({ method: "GET", url: "/api/projects" });
    assert.equal(new Headers(calls[0]?.init.headers).has("Authorization"), false);
  });

  it("builds the query string, skipping undefined values, and keeps a path in baseURL", async () => {
    const { calls, transport } = transportWith(() => json(200, {}), { baseURL: "http://api.test/v1/" });
    await transport.request({ method: "GET", url: "/projects", params: { q: "a b", status: undefined, page: 2 } });
    assert.equal(calls[0]?.url, "http://api.test/v1/projects?q=a+b&page=2");
  });

  it("sends JSON bodies and resolves undefined for 204", async () => {
    const { calls, transport } = transportWith(() => new Response(null, { status: 204 }));
    const result = await transport.request({ method: "POST", url: "/api/tasks", body: { title: "x" } });
    assert.equal(result, undefined);
    assert.equal(calls[0]?.init.body, '{"title":"x"}');
    assert.equal(new Headers(calls[0]?.init.headers).get("Content-Type"), "application/json");
  });

  it("attaches no abort signal by default, so Next.js can memoize identical GETs", async () => {
    const { calls, transport } = transportWith(() => json(200, {}));
    await transport.request({ method: "GET", url: "/api/projects" });
    assert.equal(calls[0]?.init.signal, undefined);

    const withTimeout = transportWith(() => json(200, {}), { timeoutMs: 5000 });
    await withTimeout.transport.request({ method: "GET", url: "/api/projects" });
    assert.ok(withTimeout.calls[0]?.init.signal);
  });

  it("resolves undefined for any success with an empty body, not only 204", async () => {
    for (const status of [200, 201, 202]) {
      const { transport } = transportWith(() => new Response(null, { status }));
      assert.equal(await transport.request({ method: "POST", url: "/api/contact", body: {} }), undefined);
    }
  });

  it("still parses a JSON body", async () => {
    const { transport } = transportWith(() => json(200, { data: { ok: true } }));
    assert.deepEqual(await transport.request({ method: "GET", url: "/x" }), { data: { ok: true } });
  });

  it("passes Next.js caching options through to fetch", async () => {
    const { calls, transport } = transportWith(() => json(200, {}));
    await transport.request({ method: "GET", url: "/api/projects", next: { revalidate: 60, tags: ["projects"] }, cache: "force-cache" });
    assert.deepEqual(calls[0]?.init.next, { revalidate: 60, tags: ["projects"] });
    assert.equal(calls[0]?.init.cache, "force-cache");
  });

  it("turns the API error body into an ApiError", async () => {
    const { transport } = transportWith(() => json(404, { error: { code: "not_found", message: "Project not found" } }));
    await assert.rejects(transport.request({ method: "GET", url: "/api/projects/x" }), (error: unknown) => {
      assert.ok(isApiError(error));
      assert.deepEqual([error.code, error.message, error.status], ["not_found", "Project not found", 404]);
      return true;
    });
  });

  it("falls back to a generic ApiError when the body is not an API error", async () => {
    const { transport } = transportWith(() => new Response("<html>Bad gateway</html>", { status: 502 }));
    await assert.rejects(transport.request({ method: "GET", url: "/" }), (error: unknown) => isApiError(error) && error.code === "http_error" && error.status === 502);
  });

  it("reports unreachable servers and timeouts distinctly", async () => {
    const down = transportWith(() => {
      throw new TypeError("fetch failed");
    });
    await assert.rejects(down.transport.request({ method: "GET", url: "/" }), (error: unknown) => isApiError(error) && error.code === "network_error");

    const slow = transportWith(untilAborted, { timeoutMs: 10 });
    await assert.rejects(slow.transport.request({ method: "GET", url: "/" }), (error: unknown) => isApiError(error) && error.code === "timeout");
  });

  it("calls onUnauthorized on 401 only", async () => {
    const seen: ApiError[] = [];
    const unauthorized = transportWith(() => json(401, { error: { code: "unauthenticated", message: "Sign in" } }), { onUnauthorized: (e) => seen.push(e) });
    await assert.rejects(unauthorized.transport.request({ method: "GET", url: "/" }));
    assert.equal(seen[0]?.code, "unauthenticated");

    const forbidden = transportWith(() => json(403, { error: { code: "forbidden", message: "No" } }), { onUnauthorized: (e) => seen.push(e) });
    await assert.rejects(forbidden.transport.request({ method: "GET", url: "/" }));
    assert.equal(seen.length, 1);
  });

  it("rethrows the caller's own abort so React Query can recognise it", async () => {
    const controller = new AbortController();
    const { transport } = transportWith(untilAborted);

    const pending = transport.request({ method: "GET", url: "/", signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, (error: unknown) => !isApiError(error));
  });
});
