
export const appData = {
    'name': 'Luratha',
    'logo': '/luratha.svg',
}

export const CATEGORIES = [
  { slug: "vestidos", label: "Vestidos" },
  { slug: "blusas", label: "Blusas" },
  { slug: "calcas", label: "Calças" },
  { slug: "saias", label: "Saias" },
  { slug: "shorts", label: "Shorts" },
  { slug: "conjuntos", label: "Conjuntos" },
  { slug: "moletons", label: "Moletons" },
  { slug: "acessorios", label: "Acessórios" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];