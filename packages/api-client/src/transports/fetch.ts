import { apiErrorFromResponse, networkError, timeoutError } from "../errors";
import type { RequestConfig, Transport, TransportOptions } from "../transport";

export interface FetchTransportOptions extends TransportOptions {
  /** Defaults to the global fetch. In Next.js that is the patched version with caching and revalidation. */
  fetch?: typeof fetch;
}

// timeoutMs defaults to 0 (no timeout) here, unlike the axios transport. Next.js only memoizes identical
// GETs within a render when the request carries no abort signal, and a timeout would add one.

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
  timeoutMs = 0,
  fetch: fetchImpl = globalThis.fetch,
}: FetchTransportOptions): Transport {
  return {
    async request<T>({ method, url, params, body, signal, next, cache }: RequestConfig) {
      const headers = new Headers({ Accept: "application/json" });
      if (body !== undefined) headers.set("Content-Type", "application/json");
      const token = await getToken?.();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const timeout = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;
      const signals = [signal, timeout].filter((s): s is AbortSignal => s !== undefined);
      const init: RequestInit & { next?: RequestConfig["next"]; cache?: RequestConfig["cache"] } = { method, headers };
      if (signals.length > 0) init.signal = signals.length === 1 ? signals[0]! : AbortSignal.any(signals);
      if (body !== undefined) init.body = JSON.stringify(body);
      if (next) init.next = next;
      if (cache) init.cache = cache;

      let response: Response;
      try {
        response = await fetchImpl(buildUrl(baseURL, url, params), init);
      } catch (error) {
        if (signal?.aborted) throw error;
        throw timeout?.aborted ? timeoutError() : networkError();
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
