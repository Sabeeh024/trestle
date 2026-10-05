import type { NextConfig } from "next";

import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  // Do not advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  transpilePackages: ["@trestle/ui", "@trestle/design-tokens", "@trestle/api-client", "@trestle/forms"],
};

export default nextConfig;
