import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { CATEGORIES } from "@/src/lib/constants";
import { mockProducts } from "@/src/lib/mockData";
import { Product } from "@/src/lib/types";
import Breadcrumb from "@/src/components/Breadcrumb";
import ProductGrid from "@/src/components/ProductGrid";
import SortDropdown from "@/src/components/SortDropdown";
import JsonLd from "@/src/components/JsonLd";
import type { CollectionPage, WithContext } from "schema-dts";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export function generateStaticParams() {
  return CATEGORIES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) return {};
  const url = `https://www.luratha.com.br/categoria/${slug}`;
  return {
    title: `${category.label} Artesanais`,
    description: `Explore nossa coleção de ${category.label.toLowerCase()} artesanais slow fashion. Peças únicas feitas no Brasil com qualidade e cuidado — Luratha.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${category.label} Artesanais | Luratha`,
      description: `Explore nossa coleção de ${category.label.toLowerCase()} artesanais slow fashion. Peças únicas feitas no Brasil com qualidade e cuidado — Luratha.`,
      url,
      type: "website",
    },
  };
}

function sortProducts(products: Product[], sort?: string): Product[] {
  const sorted = [...products];
  switch (sort) {
    case "menor-preco":
      return sorted.sort((a, b) => a.price - b.price);
    case "maior-preco":
      return sorted.sort((a, b) => b.price - a.price);
    case "maior-desconto":
      return sorted.sort((a, b) => {
        const discountA = a.originalPrice
          ? (a.originalPrice - a.price) / a.originalPrice
          : 0;
        const discountB = b.originalPrice
          ? (b.originalPrice - b.price) / b.originalPrice
          : 0;
        return discountB - discountA;
      });
    default:
      return sorted;
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { sort } = await searchParams;

  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) return notFound();

  const filtered = mockProducts.filter((p) => p.categorySlug === slug);
  const products = sortProducts(filtered, sort);

  const categoryUrl = `https://www.luratha.com.br/categoria/${slug}`;

  const collectionPageSchema: WithContext<CollectionPage> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.label} Artesanais – Luratha`,
    description: `Coleção de ${category.label.toLowerCase()} artesanais slow fashion feitos no Brasil.`,
    url: categoryUrl,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: "https://www.luratha.com.br" },
        { "@type": "ListItem", position: 2, name: category.label, item: categoryUrl },
      ],
    },
  };

  return (
    <div className="container-luratha section-padding">
      <JsonLd data={collectionPageSchema} />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: category.label },
        ]}
      />
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-heading)]">
            {category.label}
          </h1>
          <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/60 mt-1">
            {products.length}{" "}
            {products.length === 1 ? "produto encontrado" : "produtos encontrados"}
          </p>
        </div>
        <Suspense fallback={null}>
          <SortDropdown currentSort={sort ?? "recentes"} />
        </Suspense>
      </div>
      <ProductGrid products={products} />
    </div>
  );
}
