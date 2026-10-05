// Response headers the admin panel needs from whatever serves it. A static SPA cannot set its own, so they are
// emitted as a `_headers` file (the format Netlify and Cloudflare Pages read) and applied to `vite preview`;
// for any other host, copy the same headers into its configuration.

/** `apiUrl` is where the API lives: the only other origin the panel may talk to. */
export function securityHeaders(apiUrl: string) {
  const apiOrigin = new URL(apiUrl).origin;
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    // Report-only until a deployed build has run without reports. Scripts must come from this origin: there are
    // no inline scripts. Styles may be inline because the dialog library injects a <style> element at runtime and
    // a static page has no per-request nonce to give it; a style cannot run script, so this is the smaller risk.
    "Content-Security-Policy-Report-Only": [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self' ${apiOrigin}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      `report-uri ${apiOrigin}/api/csp-report`,
    ].join("; "),
  } as const;
}

export function headersFile(apiUrl: string) {
  const lines = Object.entries(securityHeaders(apiUrl)).map(([name, value]) => `  ${name}: ${value}`);
  return `/*\n${lines.join("\n")}\n`;
}
