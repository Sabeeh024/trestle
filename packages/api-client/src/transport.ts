import type { ApiError } from "./errors";

/** Options Next.js adds to `fetch` for caching and on-demand revalidation. Ignored by other transports. */
export interface NextFetchOptions {
  revalidate?: number | false;
  tags?: string[];
}

/** Mirrors the DOM `RequestCache` union, so the package type-checks in projects without the DOM lib. */
export type CacheMode = "default" | "force-cache" | "no-cache" | "no-store" | "only-if-cached" | "reload";

export interface RequestOptions {
  signal?: AbortSignal | undefined;
  /** Honoured by the fetch transport inside Next.js only. */
  next?: NextFetchOptions;
  /** Honoured by the fetch transport only. */
  cache?: CacheMode;
}

export interface RequestConfig extends RequestOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  url: string;
  params?: object | undefined;
  body?: unknown;
}

/**
 * The only thing the endpoint layer needs from an HTTP library. Implementations resolve with the
 * parsed JSON body (undefined for 204), and reject with an ApiError for failed responses, network
 * failures and timeouts. A caller's own abort is rethrown untouched.
 */
export interface Transport {
  request<T>(config: RequestConfig): Promise<T>;
}

export interface TransportOptions {
  baseURL: string;
  /** Called before every request; return null to send it unauthenticated. */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Called after any 401 response, e.g. to clear the session and redirect to login. */
  onUnauthorized?: (error: ApiError) => void;
  timeoutMs?: number;
}
