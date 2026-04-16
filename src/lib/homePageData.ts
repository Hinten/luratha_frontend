import { collection, getDocs, limit as queryLimit, orderBy, query } from "firebase/firestore";
import {
  CategorySchema,
  firestoreCollections,
  type FirestoreCategory,
  type Product as FirestoreProduct,
} from "@/src/schemas/firestore";
import { createProductsRepository } from "@/src/lib/repositories/productsRepository";
import { dbServer } from "@/src/lib/firebaseServer";
import type { Category, Product } from "@/src/lib/types";
import { mockCategories, mockFeatured, mockNewArrivals, mockSale } from "@/src/lib/mockData";

const DEFAULT_PRODUCT_IMAGE_URL = "https://placehold.co/600x750/F8F5F0/3A2F2A?text=Produto";
const HOME_DATA_TIMEOUT_MS = 1_500;

type HomePageData = {
  categories: Category[];
  newArrivals: Product[];
  featured: Product[];
  sale: Product[];
};

export async function getHomePageData(): Promise<HomePageData> {
  try {
    const productsRepository = createProductsRepository(dbServer);
    const [products, categories] = await withTimeout(
      Promise.all([
        productsRepository.list({ status: "active", limit: 30 }),
        listCategories(),
      ]),
      HOME_DATA_TIMEOUT_MS,
    );

    const mappedProducts = products.map(mapFirestoreProductToCard);
    const mappedCategories = categories.map(mapFirestoreCategoryToHomeCategory);

    return {
      categories: mappedCategories,
      newArrivals: mappedProducts.slice(0, 4),
      featured: [...mappedProducts]
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 4),
      sale: mappedProducts.filter((product) => product.originalPrice !== undefined).slice(0, 5),
    };
  } catch (error) {
    console.error("[homePageData] failed to load data from Firestore, using mock fallback", error);
    return {
      categories: mockCategories,
      newArrivals: mockNewArrivals,
      featured: mockFeatured,
      sale: mockSale,
    };
  }
}

async function listCategories(): Promise<FirestoreCategory[]> {
  const snapshot = await getDocs(
    query(
      collection(dbServer, firestoreCollections.categories),
      orderBy("name", "asc"),
      queryLimit(20),
    ),
  );
  return snapshot.docs.map((document) => CategorySchema.parse(document.data()));
}

function mapFirestoreCategoryToHomeCategory(category: FirestoreCategory): Category {
  return {
    label: category.name,
    href: `/categoria/${category.slug}`,
    imageUrl: `https://placehold.co/600x700/EDE4D9/3A2F2A?text=${encodeURIComponent(category.name)}`,
  };
}

function mapFirestoreProductToCard(product: FirestoreProduct): Product {
  const imageUrl = product.photoIds[0] ?? DEFAULT_PRODUCT_IMAGE_URL;
  const currentPrice = product.price.salePrice ?? product.price.price;

  return {
    id: product.id,
    name: product.title,
    slug: product.slug,
    categorySlug: product.category[0]?.slug,
    price: currentPrice,
    originalPrice: product.price.salePrice ? product.price.price : undefined,
    imageUrl,
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
