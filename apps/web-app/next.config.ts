import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@trestle/ui", "@trestle/design-tokens"],
};

export default nextConfig;
