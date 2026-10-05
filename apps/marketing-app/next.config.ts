import path from "node:path";

import type { NextConfig } from "next";

import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  // A self-contained server (server.js plus only the files it needs) for the container image. The workspace
  // packages live above this folder, so tracing starts at the repository root.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Do not advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  transpilePackages: ["@trestle/auth", "@trestle/ui", "@trestle/design-tokens", "@trestle/api-client", "@trestle/forms"],
};

export default nextConfig;
