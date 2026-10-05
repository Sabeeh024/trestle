import path from "node:path";

import type { NextConfig } from "next";

import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  // For the container image only (STANDALONE=1 in the Dockerfile): a self-contained server (server.js plus only the
  // files it needs). The workspace packages live above this folder, so tracing starts at the repository root.
  // Elsewhere (Vercel, `next dev`) the platform's own output is used.
  ...(process.env.STANDALONE === "1" ? { output: "standalone" as const, outputFileTracingRoot: path.join(__dirname, "../..") } : {}),
  // Do not advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  transpilePackages: ["@trestle/auth", "@trestle/ui", "@trestle/design-tokens", "@trestle/api-client", "@trestle/forms"],
};

export default nextConfig;
