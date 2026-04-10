import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { mockProductDetails } from "@/src/lib/mockData";
import ProductDetailPage from "@/src/components/ProductDetailPage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return mockProductDetails
    .filter((p) => p.slug)
    .map(({ slug }) => ({ slug: slug as string }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = mockProductDetails.find((p) => p.slug === slug);
  if (!product) return {};

  const description = product.description.slice(0, 160);
  return {
    title: `${product.name} — Luratha`,
    description,
    alternates: {
      canonical: `https://www.luratha.com.br/produto/${slug}`,
    },
    openGraph: {
      title: `${product.name} — Luratha`,
      description,
      url: `https://www.luratha.com.br/produto/${slug}`,
      images: [{ url: product.images[0], alt: product.name }],
    },
  };
}

export default async function ProdutoPage({ params }: PageProps) {
  const { slug } = await params;
  const product = mockProductDetails.find((p) => p.slug === slug);
  if (!product) return notFound();
  return <ProductDetailPage product={product} />;
}
