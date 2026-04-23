import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    USE_EMULATOR: process.env.USE_EMULATOR,
  },
};

export default nextConfig;
