import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/seoConstants";
import { CATEGORIES } from "@/src/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    { path: "/", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/sobre", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/contato", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/politica-de-trocas", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/referencia-de-medidas", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/todas-as-pecas", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/sale", priority: 0.9, changeFrequency: "daily" as const },
  ];

  const categoryRoutes = CATEGORIES.map(({ slug }) => ({
    path: `/categoria/${slug}`,
    priority: 0.8,
    changeFrequency: "weekly" as const,
  }));

  return [...staticRoutes, ...categoryRoutes].map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
