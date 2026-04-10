import type { MetadataRoute } from "next";

const BASE_URL = "https://www.luratha.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: Array<{
    route: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { route: "/", changeFrequency: "daily", priority: 1.0 },
    { route: "/todas-as-pecas", changeFrequency: "weekly", priority: 0.9 },
    { route: "/sale", changeFrequency: "weekly", priority: 0.9 },
    { route: "/categoria/vestidos", changeFrequency: "weekly", priority: 0.8 },
    { route: "/categoria/blusas", changeFrequency: "weekly", priority: 0.8 },
    { route: "/categoria/calcas", changeFrequency: "weekly", priority: 0.8 },
    { route: "/categoria/saias", changeFrequency: "weekly", priority: 0.8 },
    { route: "/categoria/shorts", changeFrequency: "weekly", priority: 0.8 },
    { route: "/categoria/conjuntos", changeFrequency: "weekly", priority: 0.8 },
    { route: "/categoria/moletons", changeFrequency: "weekly", priority: 0.8 },
    { route: "/categoria/acessorios", changeFrequency: "weekly", priority: 0.8 },
    { route: "/sobre", changeFrequency: "monthly", priority: 0.7 },
    { route: "/contato", changeFrequency: "monthly", priority: 0.7 },
    { route: "/politica-de-trocas", changeFrequency: "monthly", priority: 0.6 },
    { route: "/referencia-de-medidas", changeFrequency: "monthly", priority: 0.6 },
  ];

  return staticRoutes.map(({ route, changeFrequency, priority }) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
