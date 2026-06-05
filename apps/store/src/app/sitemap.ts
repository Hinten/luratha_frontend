import type { MetadataRoute } from "next";
import { SITE_URL } from "@/src/lib/seoConstants";
import { getCachedCategories } from "@/src/lib/queries/getCachedCategories";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    { path: "/", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/sobre", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/contato", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/politica-de-trocas", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/referencia-de-medidas", priority: 0.6, changeFrequency: "monthly" as const },
    // Páginas institucionais novas: priority alinhado a 0.6 com os pares acima
    // (trocas/medidas) para manter consistência relativa entre páginas do mesmo
    // tipo — em vez do 0.5 sugerido na issue #84, que destoaria dos existentes.
    { path: "/politica-de-privacidade", priority: 0.6, changeFrequency: "yearly" as const },
    { path: "/termos-de-uso", priority: 0.6, changeFrequency: "yearly" as const },
    { path: "/faq", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/entrega", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/todas-as-pecas", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/sale", priority: 0.9, changeFrequency: "daily" as const },
  ];

  const categories = await getCachedCategories();
  const categoryRoutes = categories.map(({ slug }) => ({
    path: `/colecao/${slug}`,
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
