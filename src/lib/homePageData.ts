import {
  type Category as FirestoreCategory,
  type Product as FirestoreProduct,
  type Stock,
} from "@/src/schemas/firestore";
import { createProductsRepository } from "@/src/lib/repositories/productsRepository";
import { createStockRepository } from "@/src/lib/repositories/stockRepository";
import { getAuthenticatedAppForUser } from "@/src/lib/firestore/firebaseSsrApp";
import { getCachedCategories } from "@/src/lib/queries/getCachedCategories";

const HOME_DATA_TIMEOUT_MS = 1_500;

type HomePageData = {
  categories: FirestoreCategory[];
  newArrivals: FirestoreProduct[];
  featured: FirestoreProduct[];
  sale: FirestoreProduct[];
  stockMap: Map<string, Stock>;
};

export async function getHomePageData(): Promise<HomePageData> {
  const authApp = await getAuthenticatedAppForUser();

  const productsRepository = createProductsRepository(authApp.firestore);
  const [products, categories] = await withTimeout(
    Promise.all([
      productsRepository.list({ status: "active", limit: 30 }),
      getCachedCategories(),
    ]),
    HOME_DATA_TIMEOUT_MS,
  );

  let stockMap = new Map<string, Stock>();
  if (products.length > 0) {
    const stockRepository = createStockRepository(authApp.firestore);
    stockMap = await stockRepository.getByProductIds(products.map((p) => p.id));
  }

  return {
    categories,
    newArrivals: products.slice(0, 4),
    featured: [...products]
      .sort((a, b) => (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0))
      .slice(0, 4),
    sale: products.filter((product) => product.price.salePrice !== null).slice(0, 5),
    stockMap,
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
