import type { Product, Category } from "@/src/lib/types";

export const mockProducts: Product[] = [
  {
    id: "1",
    name: "Vestido Linho Romântico",
    slug: "vestido-linho-romantico",
    price: 289.9,
    originalPrice: 389.9,
    imageUrl: "https://placehold.co/400x500/EDE4D9/3A2F2A?text=Vestido+Linho",
    rating: 4.8,
    reviewCount: 34,
    installments: { count: 3, value: 96.63 },
  },
  {
    id: "2",
    name: "Blusa Artesanal Flores",
    slug: "blusa-artesanal-flores",
    price: 149.9,
    originalPrice: 199.9,
    imageUrl: "https://placehold.co/400x500/E8B9C9/3A2F2A?text=Blusa+Flores",
    rating: 4.6,
    reviewCount: 21,
    installments: { count: 2, value: 74.95 },
  },
  {
    id: "3",
    name: "Calça Palazzo Linho",
    slug: "calca-palazzo-linho",
    price: 219.9,
    imageUrl: "https://placehold.co/400x500/A8B8A2/3A2F2A?text=Cal%C3%A7a+Palazzo",
    rating: 4.9,
    reviewCount: 47,
    installments: { count: 3, value: 73.3 },
  },
  {
    id: "4",
    name: "Vestido Midi Rendado",
    slug: "vestido-midi-rendado",
    price: 329.9,
    originalPrice: 429.9,
    imageUrl: "https://placehold.co/400x500/D9D2C7/3A2F2A?text=Vestido+Midi",
    rating: 4.7,
    reviewCount: 28,
    installments: { count: 4, value: 82.48 },
  },
  {
    id: "5",
    name: "Blusa Cropped Bordada",
    slug: "blusa-cropped-bordada",
    price: 129.9,
    imageUrl: "https://placehold.co/400x500/EDE4D9/3A2F2A?text=Blusa+Bordada",
    rating: 4.5,
    reviewCount: 15,
    installments: { count: 2, value: 64.95 },
  },
  {
    id: "6",
    name: "Vestido Boho Maxi",
    slug: "vestido-boho-maxi",
    price: 379.9,
    originalPrice: 499.9,
    imageUrl: "https://placehold.co/400x500/E8B9C9/3A2F2A?text=Vestido+Boho",
    rating: 5.0,
    reviewCount: 62,
    installments: { count: 4, value: 94.98 },
  },
  {
    id: "7",
    name: "Calça Clochard Cetim",
    slug: "calca-clochard-cetim",
    price: 199.9,
    originalPrice: 259.9,
    imageUrl: "https://placehold.co/400x500/A8B8A2/3A2F2A?text=Cal%C3%A7a+Cetim",
    rating: 4.4,
    reviewCount: 19,
    installments: { count: 2, value: 99.95 },
  },
  {
    id: "8",
    name: "Blusa Fluida Estampada",
    slug: "blusa-fluida-estampada",
    price: 119.9,
    originalPrice: 159.9,
    imageUrl: "https://placehold.co/400x500/D9D2C7/3A2F2A?text=Blusa+Fluida",
    rating: 4.3,
    reviewCount: 11,
    installments: { count: 2, value: 59.95 },
  },
];

export const mockCategories: Category[] = [
  {
    label: "Vestidos",
    href: "/categoria/vestidos",
    imageUrl: "https://placehold.co/600x700/EDE4D9/3A2F2A?text=Vestidos",
  },
  {
    label: "Blusas",
    href: "/categoria/blusas",
    imageUrl: "https://placehold.co/600x700/E8B9C9/3A2F2A?text=Blusas",
  },
  {
    label: "Calças",
    href: "/categoria/calcas",
    imageUrl: "https://placehold.co/600x700/A8B8A2/3A2F2A?text=Cal%C3%A7as",
  },
];

export const mockNewArrivals: Product[] = mockProducts.slice(0, 4);
export const mockFeatured: Product[] = mockProducts.slice(2, 6);
export const mockSale: Product[] = mockProducts.filter((p) => p.originalPrice !== undefined);
