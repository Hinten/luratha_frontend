import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  env: {
    USE_EMULATOR: process.env.USE_EMULATOR,
  },
};

export default nextConfig;
