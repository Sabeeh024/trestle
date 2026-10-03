import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";

import { ApiError, createApiClient, isApiError, type ApiClientOptions } from "./client";

function clientWith(adapter: AxiosAdapter, options: Partial<ApiClientOptions> = {}) {
  return createApiClient({ baseURL: "http://api.test", axiosConfig: { adapter }, ...options });
}

const respond =
  (status: number, data: unknown): AxiosAdapter =>
  async (config) => {
    const response = { data, status, statusText: "", headers: {}, config };
    if (status >= 400) throw new AxiosError("failed", String(status), config, null, response);
    return response;
  };

describe("createApiClient", () => {
  it("sends the bearer token, awaiting async token sources", async () => {
    let seen: InternalAxiosRequestConfig | undefined;
    const client = clientWith(async (config) => ((seen = config), { data: {}, status: 200, statusText: "", headers: {}, config }), {
      getToken: async () => "abc",
    });

    await client.get("/api/projects");
    assert.equal(seen?.headers.get("Authorization"), "Bearer abc");
  });

  it("sends no Authorization header without a token", async () => {
    let seen: InternalAxiosRequestConfig | undefined;
    const client = clientWith(async (config) => ((seen = config), { data: {}, status: 200, statusText: "", headers: {}, config }), {
      getToken: () => null,
    });

    await client.get("/api/projects");
    assert.equal(seen?.headers.has("Authorization"), false);
  });

  it("turns the API error body into an ApiError", async () => {
    const client = clientWith(respond(404, { error: { code: "not_found", message: "Project not found" } }));

    await assert.rejects(client.get("/api/projects/x"), (error: unknown) => {
      assert.ok(isApiError(error));
      assert.equal(error.code, "not_found");
      assert.equal(error.message, "Project not found");
      assert.equal(error.status, 404);
      return true;
    });
  });

  it("falls back to a generic ApiError when the body is not an API error", async () => {
    const client = clientWith(respond(502, "<html>Bad gateway</html>"));

    await assert.rejects(client.get("/"), (error: unknown) => {
      assert.ok(isApiError(error));
      assert.equal(error.code, "http_error");
      assert.equal(error.status, 502);
      return true;
    });
  });

  it("reports unreachable servers and timeouts distinctly", async () => {
    const networkDown = clientWith(async (config) => {
      throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config);
    });
    await assert.rejects(networkDown.get("/"), (error: unknown) => isApiError(error) && error.code === "network_error" && error.status === null);

    const slow = clientWith(async (config) => {
      throw new AxiosError("timeout", AxiosError.ECONNABORTED, config);
    });
    await assert.rejects(slow.get("/"), (error: unknown) => isApiError(error) && error.code === "timeout");
  });

  it("calls onUnauthorized on 401 only", async () => {
    const seen: ApiError[] = [];
    const unauthorized = clientWith(respond(401, { error: { code: "unauthenticated", message: "Sign in" } }), { onUnauthorized: (e) => seen.push(e) });
    await assert.rejects(unauthorized.get("/"));
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.code, "unauthenticated");

    const forbidden = clientWith(respond(403, { error: { code: "forbidden", message: "No" } }), { onUnauthorized: (e) => seen.push(e) });
    await assert.rejects(forbidden.get("/"));
    assert.equal(seen.length, 1);
  });

  it("leaves cancellations alone so React Query can recognise them", async () => {
    const controller = new AbortController();
    const client = clientWith(async (config) => {
      throw new AxiosError("canceled", AxiosError.ERR_CANCELED, config);
    });

    controller.abort();
    await assert.rejects(client.get("/", { signal: controller.signal }), (error: unknown) => !isApiError(error));
  });
});
