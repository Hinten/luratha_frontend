
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
  { slug: "vestidos",   label: "Vestidos",   href: "/categoria/vestidos" },
  { slug: "blusas",     label: "Blusas",     href: "/categoria/blusas" },
  { slug: "calcas",     label: "Calças",     href: "/categoria/calcas" },
  { slug: "saias",      label: "Saias",      href: "/categoria/saias" },
  { slug: "shorts",     label: "Shorts",     href: "/categoria/shorts" },
  { slug: "conjuntos",  label: "Conjuntos",  href: "/categoria/conjuntos" },
  { slug: "moletons",   label: "Moletons",   href: "/categoria/moletons" },
  { slug: "acessorios", label: "Acessórios", href: "/categoria/acessorios" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];