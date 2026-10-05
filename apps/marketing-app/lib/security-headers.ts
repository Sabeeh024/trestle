// Response headers for every page and asset. The pages are statically generated, so there is no per-request
// nonce: the Content-Security-Policy below restricts everything except where scripts and styles may come from,
// and that part is a known gap (Next's inline bootstrap scripts need a nonce, which would make every page
// dynamic). The site has no sign-in and holds no user data.
const isProduction = process.env.NODE_ENV === "production";

export const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];
