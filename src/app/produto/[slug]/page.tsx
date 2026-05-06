"use server";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import type { FirestoreCategory, Product as FirestoreProduct, Stock } from "@/src/schemas/firestore";
import { getAuthenticatedAppForUser } from "@/src/lib/firestore/firebaseSsrApp";
import { createCategoriesRepository } from "@/src/lib/repositories/categoriesRepository";
import {
  ProductRepositoryError,
  createProductsRepository,
} from "@/src/lib/repositories/productsRepository";
import { createStockRepository } from "@/src/lib/repositories/stockRepository";
import ProductDetailPage from "@/src/components/produto/ProductDetailPage";
import ViewTracker from "@/src/components/produto/ViewTracker";
import { getProductPrimaryImage } from "@/src/lib/productImages";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const DEFAULT_PRODUCT_IMAGE_URL = "/image_404.png";

const getCacheProductBySlug = cache(async (slug: string): Promise<FirestoreProduct | null> => {

  const authenticatedAppForUser = await getAuthenticatedAppForUser();
  const productsRepository = createProductsRepository(authenticatedAppForUser.firestore);

  try {
    return await productsRepository.getBySlug(slug);
  } catch (error) {
    if (error instanceof ProductRepositoryError && error.code === "not_found") {
      return null;
    }

    console.error(`[ProdutoPage] error fetching product with slug "${slug}"`, error);

    throw createHttpStatusError(500, "Erro ao carregar dados do produto.");
  }
});

const getCachedCategoryById = cache(async (categoryId: string): Promise<FirestoreCategory | null> => {
  try {
    const authenticatedAppForUser = await getAuthenticatedAppForUser();
    const categoriesRepository = createCategoriesRepository(authenticatedAppForUser.firestore);
    return await categoriesRepository.getById(categoryId);
  } catch (error) {
    console.error(`[ProdutoPage] error fetching category with id "${categoryId}"`, error);
    throw createHttpStatusError(500, "Erro ao carregar dados da categoria do produto.");
  }
});

const getCachedStockByProductId = cache(async (productId: string): Promise<Stock | null> => {
  try {
    const authenticatedAppForUser = await getAuthenticatedAppForUser();
    const stockRepository = createStockRepository(authenticatedAppForUser.firestore);
    return await stockRepository.getByProductId(productId);
  } catch (error) {
    console.error(`[ProdutoPage] error fetching stock for product "${productId}"`, error);
    throw createHttpStatusError(500, "Erro ao carregar dados de estoque do produto.");
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCacheProductBySlug(slug);
  if (!product) {
    return notFound();
  }

  const description = product.description.slice(0, 160);
  const imageUrl = getProductPrimaryImage(product, DEFAULT_PRODUCT_IMAGE_URL);
  return {
    title: `${product.title}`,
    description,
    alternates: {
      canonical: `https://www.luratha.com.br/produto/${slug}`,
    },
    openGraph: {
      title: `${product.title}`,
      description,
      url: `https://www.luratha.com.br/produto/${slug}`,
      images: [{ url: imageUrl, alt: product.title }],
    },
  };
}

export default async function ProdutoPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getCacheProductBySlug(slug);
  if (!product) {
    console.warn(`[ProdutoPage] Product with slug "${slug}" not found.`);
    return notFound();
  }

  const [category, stock] = await Promise.all([
    getCachedCategoryById(product.categoryId),
    getCachedStockByProductId(product.id),
  ]);

  return (
    <>
      <ViewTracker slug={product.slug} />
      <ProductDetailPage product={product} category={category} stock={stock} />
    </>
  );
}

function createHttpStatusError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
