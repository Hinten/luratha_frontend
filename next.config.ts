import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["firebase", "firebase-admin"],
};

export default nextConfig;
