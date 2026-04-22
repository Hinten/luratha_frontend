import {
  type FirestoreCategory,
  type Product as FirestoreProduct,
} from "@/src/schemas/firestore";
import { listActiveProducts, listCategories } from "@/src/lib/repositories/publicCatalogAdminRepository";
import type { Category } from "@/src/lib/types";
import { mockCategories } from "@/src/lib/mockData";
import { buildMockProducts } from "@/src/lib/repositories/productsMockData";
const HOME_DATA_TIMEOUT_MS = 1_500;

type HomePageData = {
  categories: Category[];
  newArrivals: FirestoreProduct[];
  featured: FirestoreProduct[];
  sale: FirestoreProduct[];
};


export async function getHomePageData(): Promise<HomePageData> {
  try {
    const [products, categories] = await withTimeout(
      Promise.all([
        listActiveProducts(30),
        listCategories(20),
      ]),
      HOME_DATA_TIMEOUT_MS,
    );

    const mappedCategories = categories.map(mapFirestoreCategoryToHomeCategory);

    return {
      categories: mappedCategories,
      newArrivals: products.slice(0, 4),
      featured: [...products]
        .sort((a, b) => (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0))
        .slice(0, 4),
      sale: products.filter((product) => product.price.salePrice !== null).slice(0, 5),
    };
  } catch (error) {
    console.error("[homePageData] failed to load data from Firestore, using mock fallback", error);
    const mockProducts = buildMockProducts();
    return {
      categories: mockCategories,
      newArrivals: mockProducts.slice(0, 4),
      featured: [...mockProducts].sort((a, b) => (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0)).slice(0, 4),
      sale: mockProducts.filter((product) => product.price.salePrice !== null).slice(0, 5),
    };
  }
}

function mapFirestoreCategoryToHomeCategory(category: FirestoreCategory): Category {
  return {
    label: category.name,
    href: `/categoria/${category.slug}`,
    imageUrl: `https://placehold.co/600x700/EDE4D9/3A2F2A?text=${encodeURIComponent(category.name)}`,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Home data timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
