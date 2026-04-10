import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/conta/", "/carrinho/", "/api/"],
    },
    sitemap: "https://www.luratha.com.br/sitemap.xml",
  };
}
