import {
  type Category as FirestoreCategory,
  type Product as FirestoreProduct,
  type Stock,
} from "@luratha/schemas";
import { createProductsRepository } from "@luratha/repositories/productsRepository";
import { createStockRepository } from "@luratha/repositories/stockRepository";
import { getAuthenticatedAppForUser } from "@luratha/firestore/firebaseSsrApp";
import { getCachedCategories } from "@/src/lib/queries/getCachedCategories";

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

  // Removed timout, using page cache later to ensure data is fresh while avoiding timeouts on slow connections or large datasets.
  const [products, categories] = await Promise.all([
    productsRepository.list({ status: "active", limit: 30 }),
    getCachedCategories(),
  ]).then((results) => results);

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
