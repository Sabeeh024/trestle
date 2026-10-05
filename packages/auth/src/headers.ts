// Response headers shared by every app and the API, so a change is made once.

export const permissionsPolicy = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

export const HSTS = "max-age=63072000; includeSubDomains";

const baseline = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": permissionsPolicy,
  "Cross-Origin-Opener-Policy": "same-origin",
} as const;

/** The headers every page should carry. HSTS is for production only (it needs HTTPS and is remembered). */
export function securityHeaders({ referrerPolicy = "strict-origin-when-cross-origin", hsts = false } = {}): Record<string, string> {
  return { ...baseline, "Referrer-Policy": referrerPolicy, ...(hsts ? { "Strict-Transport-Security": HSTS } : {}) };
}

/** The same headers in the `{ key, value }[]` shape Next.js's `headers()` wants. */
export function nextHeaders(options?: Parameters<typeof securityHeaders>[0]) {
  return Object.entries(securityHeaders(options)).map(([key, value]) => ({ key, value }));
}
