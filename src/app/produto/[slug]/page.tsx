"use server";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import type { FirestoreCategory, Product as FirestoreProduct } from "@/src/schemas/firestore";
import { getCategoryById, getProductBySlug } from "@/src/lib/repositories/publicCatalogAdminRepository";
import ProductDetailPage from "@/src/components/produto/ProductDetailPage";
import { getProductPrimaryImage } from "@/src/lib/productImages";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const DEFAULT_PRODUCT_IMAGE_URL = "https://placehold.co/600x750/F8F5F0/3A2F2A?text=Produto";

const getCacheProductBySlug = cache(async (slug: string): Promise<FirestoreProduct | null> => {
  try {
    return await getProductBySlug(slug);
  } catch (error) {
    console.error(`[ProdutoPage] error fetching product with slug "${slug}"`, error);

    throw createHttpStatusError(500, "Erro ao carregar dados do produto.");
  }
});

const getCachedCategoryById = cache(async (categoryId: string): Promise<FirestoreCategory | null> => {
  try {
    return await getCategoryById(categoryId);
  } catch (error) {
    console.error(`[ProdutoPage] error fetching category with id "${categoryId}"`, error);
    return null;
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

  const category = await getCachedCategoryById(product.categoryId);

  return <ProductDetailPage product={product} category={category} />;
}

function createHttpStatusError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
