export interface Product {
  id: string;
  name: string;
  slug?: string;
  categorySlug?: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  rating?: number;
  reviewCount?: number;
  installments?: { count: number; value: number };
}

export interface Category {
  label: string;
  href: string;
  imageUrl: string;
}
