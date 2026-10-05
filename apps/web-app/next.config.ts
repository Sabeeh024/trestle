import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  transpilePackages: ["@trestle/ui", "@trestle/design-tokens", "@trestle/api-client", "@trestle/forms"],
};

export default nextConfig;
