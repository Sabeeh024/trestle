// The session cookie, described once so every place that sets or reads it agrees.

const BASE_NAME = "trestle_session";

/**
 * In production the cookie carries the `__Host-` prefix, which makes browsers refuse it unless it is Secure,
 * has Path=/ and has no Domain: it can then only be set by, and sent to, exactly one host, and a sibling
 * subdomain cannot overwrite it. The prefix needs HTTPS, so development uses the bare name.
 */
export function sessionCookieName(secure: boolean) {
  return secure ? `__Host-${BASE_NAME}` : BASE_NAME;
}

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  /** Seconds. Matches how long the server keeps the session, so the cookie does not outlive it. */
  maxAge: number;
}

/** HttpOnly keeps page scripts from reading it; Lax keeps other sites from sending it on a cross-site POST. */
export function sessionCookieOptions({ secure, ttlDays }: { secure: boolean; ttlDays: number }): SessionCookieOptions {
  return { httpOnly: true, sameSite: "lax", path: "/", secure, maxAge: Math.round(ttlDays * 86_400) };
}

/** A `Set-Cookie` header value for the cookie (or, with `value` empty, one that deletes it). */
export function serializeSessionCookie(name: string, value: string, options: SessionCookieOptions) {
  const parts = [`${name}=${value}`, `Path=${options.path}`, "HttpOnly", "SameSite=Lax"];
  if (options.secure) parts.push("Secure");
  parts.push(value ? `Max-Age=${options.maxAge}` : "Max-Age=0");
  return parts.join("; ");
}

/** Reads one cookie out of a `Cookie` request header. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim() || undefined;
  }
  return undefined;
}
