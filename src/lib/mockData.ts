import type { Product, Category, ProductDetail } from "./types";
import { CATEGORIES } from "./constants";

// ─── Catalog products (used by /categoria/[slug], /todas-as-pecas, /sale) ─────

export const mockProducts: (Product & { categorySlug: string })[] = [
  // Vestidos (3)
  {
    id: "v1",
    name: "Vestido Bordado Floral",
    slug: "vestido-bordado-floral",
    categorySlug: "vestidos",
    price: 289,
    originalPrice: 389,
    imageUrl: "https://placehold.co/400x500/EDE4D9/3A2F2A?text=Vestido+Bordado",
    rating: 4.8,
    reviewCount: 24,
    installments: { count: 3, value: 96.33 },
  },
  {
    id: "v2",
    name: "Vestido Midi Linho",
    slug: "vestido-midi-linho",
    categorySlug: "vestidos",
    price: 320,
    imageUrl: "https://placehold.co/400x500/E8B9C9/3A2F2A?text=Vestido+Midi",
    rating: 4.6,
    reviewCount: 18,
  },
  {
    id: "v3",
    name: "Vestido Plissado Artesanal",
    slug: "vestido-plissado-artesanal",
    categorySlug: "vestidos",
    price: 410,
    imageUrl: "https://placehold.co/400x500/A8B8A2/3A2F2A?text=Vestido+Plissado",
    rating: 4.9,
    reviewCount: 31,
    installments: { count: 4, value: 102.5 },
  },
  // Blusas (2)
  {
    id: "b1",
    name: "Blusa Cropped Crochet",
    slug: "blusa-cropped-crochet",
    categorySlug: "blusas",
    price: 149,
    originalPrice: 199,
    imageUrl: "https://placehold.co/400x500/EDE4D9/3A2F2A?text=Blusa+Crochet",
    rating: 4.7,
    reviewCount: 15,
  },
  {
    id: "b2",
    name: "Blusa Linho Off-White",
    slug: "blusa-linho-off-white",
    categorySlug: "blusas",
    price: 129,
    imageUrl: "https://placehold.co/400x500/F8F5F0/3A2F2A?text=Blusa+Linho",
    rating: 4.5,
    reviewCount: 12,
  },
  // Calças (2)
  {
    id: "c1",
    name: "Calça Wide Leg Linho",
    slug: "calca-wide-leg-linho",
    categorySlug: "calcas",
    price: 259,
    imageUrl: "https://placehold.co/400x500/D9D2C7/3A2F2A?text=Calca+Wide",
    rating: 4.8,
    reviewCount: 22,
    installments: { count: 3, value: 86.33 },
  },
  {
    id: "c2",
    name: "Calça Jogger Artesanal",
    slug: "calca-jogger-artesanal",
    categorySlug: "calcas",
    price: 219,
    originalPrice: 279,
    imageUrl: "https://placehold.co/400x500/A8B8A2/3A2F2A?text=Calca+Jogger",
    rating: 4.6,
    reviewCount: 9,
  },
  // Saias (2)
  {
    id: "s1",
    name: "Saia Midi Plissada",
    slug: "saia-midi-plissada",
    categorySlug: "saias",
    price: 199,
    imageUrl: "https://placehold.co/400x500/E8B9C9/3A2F2A?text=Saia+Midi",
    rating: 4.7,
    reviewCount: 17,
  },
  {
    id: "s2",
    name: "Saia Assimétrica Bordada",
    slug: "saia-assimetrica-bordada",
    categorySlug: "saias",
    price: 239,
    originalPrice: 299,
    imageUrl: "https://placehold.co/400x500/EDE4D9/3A2F2A?text=Saia+Assimetrica",
    rating: 4.9,
    reviewCount: 28,
  },
  // Shorts (1)
  {
    id: "sh1",
    name: "Short Linho Bordado",
    slug: "short-linho-bordado",
    categorySlug: "shorts",
    price: 169,
    imageUrl: "https://placehold.co/400x500/D9D2C7/3A2F2A?text=Short+Linho",
    rating: 4.5,
    reviewCount: 8,
  },
  // Conjuntos (2)
  {
    id: "co1",
    name: "Conjunto Saia + Blusa Crochet",
    slug: "conjunto-saia-blusa-crochet",
    categorySlug: "conjuntos",
    price: 389,
    originalPrice: 499,
    imageUrl: "https://placehold.co/400x500/A8B8A2/3A2F2A?text=Conjunto+Crochet",
    rating: 4.9,
    reviewCount: 36,
    installments: { count: 4, value: 97.25 },
  },
  {
    id: "co2",
    name: "Conjunto Calça + Blusa Linho",
    slug: "conjunto-calca-blusa-linho",
    categorySlug: "conjuntos",
    price: 359,
    imageUrl: "https://placehold.co/400x500/EDE4D9/3A2F2A?text=Conjunto+Linho",
    rating: 4.7,
    reviewCount: 14,
  },
  // Moletons (2)
  {
    id: "m1",
    name: "Moletom Bordado Slow Fashion",
    slug: "moletom-bordado-slow-fashion",
    categorySlug: "moletons",
    price: 299,
    originalPrice: 379,
    imageUrl: "https://placehold.co/400x500/F8F5F0/3A2F2A?text=Moletom+Bordado",
    rating: 4.8,
    reviewCount: 21,
    installments: { count: 3, value: 99.67 },
  },
  {
    id: "m2",
    name: "Moletom Oversized Natural",
    slug: "moletom-oversized-natural",
    categorySlug: "moletons",
    price: 269,
    imageUrl: "https://placehold.co/400x500/D9D2C7/3A2F2A?text=Moletom+Oversized",
    rating: 4.6,
    reviewCount: 11,
  },
  // Acessórios (1)
  {
    id: "a1",
    name: "Bolsa Palha Artesanal",
    slug: "bolsa-palha-artesanal",
    categorySlug: "acessorios",
    price: 189,
    imageUrl: "https://placehold.co/400x500/E8B9C9/3A2F2A?text=Bolsa+Palha",
    rating: 4.9,
    reviewCount: 43,
  },
];

// ─── Home page sections ────────────────────────────────────────────────────────

export const mockCategories: Category[] = CATEGORIES.map(({ slug, label, href }) => ({
  label,
  href,
  imageUrl: `https://placehold.co/600x700/EDE4D9/3A2F2A?text=${encodeURIComponent(label)}`,
}));

export const mockNewArrivals: Product[] = mockProducts.slice(0, 4);

export const mockFeatured: Product[] = [
  mockProducts[2],  // Vestido Plissado
  mockProducts[5],  // Calça Wide Leg
  mockProducts[10], // Conjunto Crochet
  mockProducts[12], // Moletom Bordado
];

export const mockSale: Product[] = mockProducts.filter(
  (p) => p.originalPrice !== undefined
);

// ─── Product Detail entries (used by /produto/[slug]) ─────────────────────────

export const mockProductDetails: ProductDetail[] = [
  {
    id: "v1",
    name: "Vestido Bordado Floral",
    slug: "vestido-bordado-floral",
    categorySlug: "vestidos",
    price: 289,
    originalPrice: 389,
    imageUrl: "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Vestido+Bordado",
    rating: 4.8,
    reviewCount: 24,
    installments: { count: 3, value: 96.33 },
    description:
      "Um vestido artesanal bordado à mão com motivos florais delicados, confeccionado em tecido linho de alta qualidade. Perfeito para ocasiões especiais ou para iluminar o dia a dia com charme e feminilidade. Cada peça é única, feita com amor e atenção a cada ponto do bordado.",
    images: [
      "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Vestido+Bordado+1",
      "https://placehold.co/600x750/D9D2C7/3A2F2A?text=Vestido+Bordado+2",
      "https://placehold.co/600x750/E8B9C9/3A2F2A?text=Vestido+Bordado+3",
    ],
    sizes: ["PP", "P", "M", "G", "GG"],
    reviews: [
      {
        id: "r1",
        author: "Ana Claudia",
        rating: 5,
        comment:
          "Amei o vestido! O bordado é lindo e o tecido é de ótima qualidade. Chegou muito bem embalado.",
        date: "2026-03-15",
      },
      {
        id: "r2",
        author: "Fernanda Lima",
        rating: 5,
        comment:
          "Simplesmente perfeito. Cada detalhe do bordado é impecável. Vale cada centavo!",
        date: "2026-02-28",
      },
      {
        id: "r3",
        author: "Mariana Costa",
        rating: 4,
        comment:
          "Muito bonito e bem feito. Só achei que poderia ter mais opções de cores, mas a qualidade é incrível.",
        date: "2026-02-10",
      },
    ],
  },
  {
    id: "co1",
    name: "Conjunto Saia + Blusa Crochet",
    slug: "conjunto-saia-blusa-crochet",
    categorySlug: "conjuntos",
    price: 389,
    originalPrice: 499,
    imageUrl: "https://placehold.co/600x750/A8B8A2/3A2F2A?text=Conjunto+Crochet",
    rating: 4.9,
    reviewCount: 36,
    installments: { count: 4, value: 97.25 },
    description:
      "Conjunto artesanal em crochet feito à mão, composto por saia midi e blusa cropped. Tecido responsável, produzido em pequena escala com fio de algodão natural. Ideal para o verão brasileiro, este conjunto é versátil, confortável e cheio de personalidade.",
    images: [
      "https://placehold.co/600x750/A8B8A2/3A2F2A?text=Conjunto+Crochet+1",
      "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Conjunto+Crochet+2",
      "https://placehold.co/600x750/E8B9C9/3A2F2A?text=Conjunto+Crochet+3",
    ],
    sizes: ["PP", "P", "M", "G"],
    reviews: [
      {
        id: "r4",
        author: "Juliana Ramos",
        rating: 5,
        comment:
          "O conjunto é uma obra de arte! O crochet é feito à mão e dá pra ver o cuidado em cada malha. Recebi muitos elogios.",
        date: "2026-03-20",
      },
      {
        id: "r5",
        author: "Patricia Oliveira",
        rating: 5,
        comment:
          "Qualidade artesanal de verdade. A saia e a blusa combinam perfeitamente. Já quero comprar mais peças.",
        date: "2026-03-01",
      },
      {
        id: "r6",
        author: "Sofia Mendes",
        rating: 4,
        comment:
          "Muito bem feito. O fio é de qualidade e o caimento é ótimo. Recomendo o tamanho acima se preferir algo mais folgado.",
        date: "2026-02-14",
      },
    ],
  },
  {
    id: "m1",
    name: "Moletom Bordado Slow Fashion",
    slug: "moletom-bordado-slow-fashion",
    categorySlug: "moletons",
    price: 299,
    originalPrice: 379,
    imageUrl: "https://placehold.co/600x750/F8F5F0/3A2F2A?text=Moletom+Bordado",
    rating: 4.8,
    reviewCount: 21,
    installments: { count: 3, value: 99.67 },
    description:
      "Moletom oversized com bordado artesanal slow fashion, confeccionado em moletom flanelado de algodão orgânico. Confortável, quentinho e com identidade própria. O bordado frontal é feito à mão, tornando cada peça única. Perfeito para os dias mais frescos sem abrir mão do estilo.",
    images: [
      "https://placehold.co/600x750/F8F5F0/3A2F2A?text=Moletom+Bordado+1",
      "https://placehold.co/600x750/D9D2C7/3A2F2A?text=Moletom+Bordado+2",
      "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Moletom+Bordado+3",
    ],
    sizes: ["P", "M", "G", "GG"],
    reviews: [
      {
        id: "r7",
        author: "Beatriz Santos",
        rating: 5,
        comment:
          "O moletom mais bonito que já tive! Macio, quentinho e o bordado é delicado demais. Amo a proposta slow fashion.",
        date: "2026-03-25",
      },
      {
        id: "r8",
        author: "Camila Ferreira",
        rating: 5,
        comment:
          "Qualidade premium. O tecido é grossinho e macio, e o bordado é muito bem feito. Chegou rapidinho e bem embalado.",
        date: "2026-03-08",
      },
      {
        id: "r9",
        author: "Leticia Carvalho",
        rating: 4,
        comment:
          "Muito bonito e de qualidade. Só demorou um pouco mais para chegar, mas valeu a espera. Super recomendo!",
        date: "2026-02-22",
      },
    ],
  },
];
