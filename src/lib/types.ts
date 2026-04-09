
export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  categorySlug: string;
  isArtisanal?: boolean;
}
