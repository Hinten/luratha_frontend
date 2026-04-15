"use server";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import type { Product as FirestoreProduct } from "@/src/schemas/firestore";
import { dbServer } from "@/src/lib/firebaseServer";
import {
  ProductRepositoryError,
  createProductsRepository,
} from "@/src/lib/repositories/productsRepository";
import ProductDetailPage from "@/src/components/produto/ProductDetailPage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const DEFAULT_PRODUCT_IMAGE_URL = "https://placehold.co/600x750/F8F5F0/3A2F2A?text=Produto";
const productsRepository = createProductsRepository(dbServer);

const getCacheProductBySlug = cache(async (slug: string): Promise<FirestoreProduct | null> => {
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getCacheProductBySlug(slug);
  if (!product) {
    return {};
  }

  const description = product.description.slice(0, 160);
  const imageUrl = product.photoIds[0] ?? DEFAULT_PRODUCT_IMAGE_URL;
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
    return notFound();
  }

  return <ProductDetailPage product={product} />;
}

function createHttpStatusError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
