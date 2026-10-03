import { apiErrorFromResponse, networkError, timeoutError } from "../errors";
import type { RequestConfig, Transport, TransportOptions } from "../transport";

export interface FetchTransportOptions extends TransportOptions {
  /** Defaults to the global fetch. In Next.js that is the patched version with caching and revalidation. */
  fetch?: typeof fetch;
}

function buildUrl(baseURL: string, url: string, params: object | undefined) {
  // Joined as strings, not resolved with new URL(url, base), so a path in baseURL (e.g. /v1) is kept.
  const target = new URL(`${baseURL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) target.searchParams.set(key, String(value));
  }
  return target;
}

/** The native transport. Works anywhere `fetch` does, and passes Next.js `next` / `cache` options straight through. */
export function createFetchTransport({
  baseURL,
  getToken,
  onUnauthorized,
  timeoutMs = 15_000,
  fetch: fetchImpl = globalThis.fetch,
}: FetchTransportOptions): Transport {
  return {
    async request<T>({ method, url, params, body, signal, next, cache }: RequestConfig) {
      const headers = new Headers({ Accept: "application/json" });
      if (body !== undefined) headers.set("Content-Type", "application/json");
      const token = await getToken?.();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const timeout = AbortSignal.timeout(timeoutMs);
      const init: RequestInit & { next?: RequestConfig["next"]; cache?: RequestConfig["cache"] } = {
        method,
        headers,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      if (next) init.next = next;
      if (cache) init.cache = cache;

      let response: Response;
      try {
        response = await fetchImpl(buildUrl(baseURL, url, params), init);
      } catch (error) {
        if (signal?.aborted) throw error;
        throw timeout.aborted ? timeoutError() : networkError();
      }

      if (!response.ok) {
        const error = apiErrorFromResponse(response.status, await response.json().catch(() => undefined));
        if (response.status === 401) onUnauthorized?.(error);
        throw error;
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    },
  };
}
