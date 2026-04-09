
export const appData = {
    'name': 'Luratha',
    'logo': '/luratha.svg',
}

export const contactData = {
  phone: "(12) 98278-9225",
  phoneTel: "+5512982789225",
  whatsapp: "5512982789225",
  facebook: "https://facebook.com/Lurathaa",
  instagram: "https://instagram.com/_luratha",
  youtube: "https://youtube.com/channel/UC2RLNR2ZAzUxB97XYNFUnBg",
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