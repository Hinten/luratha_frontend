import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Serve /produto/:slug from the /categoria/:slug route internally.
        // The visible URL stays as /produto/:slug (rewrite is transparent).
        source: "/produto/:slug",
        destination: "/categoria/:slug",
      },
    ];
  },
};

export default nextConfig;
