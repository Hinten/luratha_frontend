import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/seoConstants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/conta/", "/carrinho/", "/checkout", "/recuperar-senha", "/api/", "/busca?*"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
