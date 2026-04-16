import { NextResponse } from "next/server";
import type { FirestoreCategory, Product } from "@/src/schemas/firestore";
import { firestoreCollections } from "@/src/schemas/firestore";
import { buildHomeSeedCategories, buildHomeSeedProducts } from "@/src/lib/repositories/homeSeedMockData";
import { adminDb } from "@/src/lib/firebaseAdmin";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const categories = buildHomeSeedCategories();
  const products = buildHomeSeedProducts(categories);

  const categoriesCreated = await seedCategories(categories);
  const productsCreated = await seedProducts(products);

  return NextResponse.json({
    message: "Dados mock cadastrados com sucesso.",
    categoriesCreated,
    productsCreated,
  });
}

async function seedCategories(categories: FirestoreCategory[]): Promise<number> {
  const results = await Promise.all(
    categories.map(async (category) => {
      const categoryRef = adminDb.collection(firestoreCollections.categories).doc(category.id);
      const existingCategory = await categoryRef.get();
      if (existingCategory.exists) {
        return false;
      }

      await categoryRef.set(category);
      return true;
    }),
  );
  return results.filter(Boolean).length;
}

async function seedProducts(products: Product[]): Promise<number> {
  const results = await Promise.all(
    products.map(async (product) => {
      const productRef = adminDb.collection(firestoreCollections.products).doc(product.id);
      const existingProduct = await productRef.get();
      if (existingProduct.exists) {
        return false;
      }

      await productRef.set(product);
      return true;
    }),
  );
  return results.filter(Boolean).length;
}
