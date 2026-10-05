// Response headers for every page and asset. They do not depend on the request, so next.config applies them
// statically; the Content-Security-Policy, which needs a fresh nonce per request, is built in proxy.ts.
const isProduction = process.env.NODE_ENV === "production";

export const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

// The reset link carries a one-time token in its URL, so the page must never send it on as a Referer.
export const resetPasswordHeaders = [{ key: "Referrer-Policy", value: "no-referrer" }];

/**
 * The page's Content-Security-Policy. Scripts need the per-request nonce (and may load further scripts they
 * trust through strict-dynamic); everything else is same-origin. Inline style attributes are allowed because
 * UI components set them (progress bars, popper positioning), which cannot run script.
 */
export function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // React uses eval in development only, for debugging aids.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
