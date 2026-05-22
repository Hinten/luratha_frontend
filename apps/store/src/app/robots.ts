import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/seoConstants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/conta/", "/carrinho/", "/api/", "/busca?*"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
