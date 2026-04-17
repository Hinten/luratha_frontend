import type { FirestoreCategory, Product as FirestoreProduct } from "@/src/schemas/firestore";
import type { Product } from "@/src/lib/types";

const DEFAULT_PRODUCT_IMAGE_URL = "https://placehold.co/600x750/F8F5F0/3A2F2A?text=Produto";

export function mapFirestoreProductToCard(
  product: FirestoreProduct,
  options: {
    categorySlug?: string;
    categoryById?: Map<string, FirestoreCategory>;
  } = {},
): Product {
  const imageUrl = product.photoIds[0]?.trim() || DEFAULT_PRODUCT_IMAGE_URL;
  const currentPrice = product.price.salePrice ?? product.price.price;
  const categorySlug = options.categorySlug ?? options.categoryById?.get(product.categoryId)?.slug;

  return {
    id: product.id,
    name: product.title,
    slug: product.slug,
    categorySlug,
    price: currentPrice,
    originalPrice: product.price.salePrice ? product.price.price : undefined,
    imageUrl,
    rating: product.ratingAverage ?? undefined,
    reviewCount: product.reviewCount ?? undefined,
  };
}
