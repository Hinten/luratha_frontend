import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Product as FirestoreProduct } from "@/src/schemas/firestore";
import { db } from "@/src/lib/firebaseClient";
import {
  ProductRepositoryError,
  createProductsRepository,
} from "@/src/lib/repositories/productsRepository";
import type { ProductDetail } from "@/src/lib/types";
import ProductDetailPage from "@/src/components/produto/ProductDetailPage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const DEFAULT_PRODUCT_IMAGE_URL = "https://placehold.co/600x750/F8F5F0/3A2F2A?text=Produto";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProductBySlug(slug);
  if (!product) {
    return {};
  }

  const description = product.description.slice(0, 160);
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
      images: [{ url: product.photoIds[0], alt: product.title }],
    },
  };
}

export default async function ProdutoPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await loadProductBySlug(slug);
  if (!product) {
    return notFound();
  }

  return <ProductDetailPage product={mapProductToProductDetail(product)} />;
}

async function loadProductBySlug(slug: string): Promise<FirestoreProduct | null> {
  return await createProductsRepository(db).getBySlug(slug);
}

function mapProductToProductDetail(product: FirestoreProduct): ProductDetail {
  const images = product.photoIds.length > 0
    ? product.photoIds
    : [DEFAULT_PRODUCT_IMAGE_URL];
  const uniqueSizes = Array.from(
    new Set([
      ...(product.size ?? []),
      ...(product.variants?.flatMap((variant) => variant.size ?? []) ?? []),
    ]),
  );
  const categorySlug = product.category[0]?.slug ?? "outros";

  return {
    id: product.id,
    name: product.title,
    slug: product.slug,
    categorySlug,
    price: product.price.salePrice ?? product.price.price,
    originalPrice: product.price.salePrice ? product.price.price : undefined,
    imageUrl: images[0],
    description: product.description,
    images,
    sizes: uniqueSizes,
  };
}

function createHttpStatusError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
