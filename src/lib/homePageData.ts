import {
  type Category as FirestoreCategory,
  type Product as FirestoreProduct,
} from "@/src/schemas/firestore";
import { createProductsRepository } from "@/src/lib/repositories/productsRepository";
import { getAuthenticatedAppForUser } from "@/src/lib/firestore/firebaseSsrApp";
import { buildMockProducts } from "@/src/lib/repositories/productsMockData";
import { getCachedCategories } from "@/src/lib/queries/getCachedCategories";
const HOME_DATA_TIMEOUT_MS = 1_500;

type HomePageData = {
  categories: FirestoreCategory[];
  newArrivals: FirestoreProduct[];
  featured: FirestoreProduct[];
  sale: FirestoreProduct[];
};


export async function getHomePageData(): Promise<HomePageData> {
  try {

    const authApp = await getAuthenticatedAppForUser();

    const productsRepository = createProductsRepository(authApp.firestore);
    const [products, categories] = await withTimeout(
      Promise.all([
        productsRepository.list({ status: "active", limit: 30 }),
        getCachedCategories(),
      ]),
      HOME_DATA_TIMEOUT_MS,
    );

    return {
      categories,
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
      categories: [],
      newArrivals: mockProducts.slice(0, 4),
      featured: [...mockProducts].sort((a, b) => (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0)).slice(0, 4),
      sale: mockProducts.filter((product) => product.price.salePrice !== null).slice(0, 5),
    };
  }
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
