// Checks on incoming requests that apply to every server in the repo.

/** The token from an `Authorization: Bearer <token>` header, if there is one. */
export function bearerToken(header: string | null | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7).trim() || undefined;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface WriteCheck {
  method: string;
  /** The `Origin` request header. */
  origin: string | null | undefined;
  /** The `Sec-Fetch-Site` request header, which browsers set and pages cannot forge. */
  fetchSite: string | null | undefined;
}

/**
 * Whether a request that changes something may proceed when the browser authenticates it automatically (with a
 * cookie). Reads are always fine. A write must not be marked cross-site by the browser, and if it names an
 * origin that origin must be one of ours. A request with neither header comes from something other than a
 * browser, which has no ambient cookie to abuse.
 */
export function isTrustedWrite({ method, origin, fetchSite }: WriteCheck, allowedOrigins: readonly string[]) {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  if (fetchSite === "cross-site") return false;
  if (origin) return allowedOrigins.includes(origin);
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}

export const INTERNAL_KEY_HEADER = "x-internal-key";
export const CLIENT_IP_HEADER = "x-client-ip";

/**
 * Headers for a server (a Next.js app) calling the API on behalf of a browser. The API would otherwise see only
 * the server's own address and user agent for every visitor, so per-client rate limits would be shared by
 * everyone. The browser's address and user agent are passed along, together with the shared key that tells the
 * API they come from one of our servers rather than from a caller who could have written anything.
 * Without a key the address is not sent, because an unauthenticated claim about it is worth nothing. The user agent
 * always is: it only labels a device in the person's own list of sessions.
 */
export function clientHeadersForApi(incoming: { get(name: string): string | null }, internalKey: string | undefined): Record<string, string> {
  const userAgent = incoming.get("user-agent");
  const headers: Record<string, string> = userAgent ? { "User-Agent": userAgent } : {};
  if (!internalKey) return headers;
  const forwarded = incoming.get("x-real-ip") ?? incoming.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ...headers, [INTERNAL_KEY_HEADER]: internalKey, ...(forwarded ? { [CLIENT_IP_HEADER]: forwarded } : {}) };
}
