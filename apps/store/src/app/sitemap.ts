import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/seoConstants";
import { getCachedCategories } from "@/src/lib/queries/getCachedCategories";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    { path: "/", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/sobre", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/contato", priority: 0.8, changeFrequency: "weekly" as const },
    // Páginas institucionais (conteúdo de apoio): priority 0.5 conforme a issue
    // #84. Todas alinhadas em 0.5 — inclusive trocas/medidas, antes em 0.6 — para
    // manter consistência relativa entre páginas do mesmo tipo.
    { path: "/politica-de-trocas", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/referencia-de-medidas", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/politica-de-privacidade", priority: 0.5, changeFrequency: "yearly" as const },
    { path: "/politica-de-dados", priority: 0.5, changeFrequency: "yearly" as const },
    { path: "/termos-de-uso", priority: 0.5, changeFrequency: "yearly" as const },
    { path: "/faq", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/entrega", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/todas-as-pecas", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/sale", priority: 0.9, changeFrequency: "daily" as const },
  ];

  const categories = await getCachedCategories();
  const categoryRoutes = categories.map(({ slug }) => ({
    path: `/categoria/${slug}`,
    priority: 0.8 as const,
    changeFrequency: "weekly" as const,
  }));

  return [...staticRoutes, ...categoryRoutes].map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
