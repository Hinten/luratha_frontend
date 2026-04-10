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

export interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

export interface ProductDetail extends Product {
  description: string;
  images: string[];
  sizes: string[];
  categorySlug: string;
  reviews?: Review[];
}
