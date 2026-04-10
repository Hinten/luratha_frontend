import { Suspense } from "react";
import type { Metadata } from "next";
import { mockProducts } from "@/src/lib/mockData";
import { Product } from "@/src/lib/types";
import Breadcrumb from "@/src/components/Breadcrumb";
import ProductGrid from "@/src/components/ProductGrid";
import SortDropdown from "@/src/components/categoria/SortDropdown";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, DEFAULT_OG_IMAGE, LURATHA_SCHEMA } from "@/src/lib/seoConstants";

export const metadata: Metadata = {
  title: "Todas as Peças",
  description:
    "Explore o catálogo completo da Luratha — slow fashion artesanal feminino brasileiro. Vestidos, blusas, calças, saias e muito mais.",
  alternates: { canonical: `${SITE_URL}/todas-as-pecas` },
  openGraph: {
    title: "Todas as Peças | Luratha",
    description:
      "Explore o catálogo completo da Luratha — slow fashion artesanal feminino brasileiro.",
    url: `${SITE_URL}/todas-as-pecas`,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

const collectionPageSchema = {
  "@context": "https://schema.org" as const,
  "@type": "CollectionPage",
  name: "Todas as Peças – Luratha",
  description:
    "Catálogo completo da Luratha — slow fashion artesanal feminino brasileiro.",
  url: `${SITE_URL}/todas-as-pecas`,
  isPartOf: {
    "@type": "WebSite",
    name: LURATHA_SCHEMA.name,
    url: LURATHA_SCHEMA.url,
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org" as const,
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Início",
      item: SITE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Todas as Peças",
      item: `${SITE_URL}/todas-as-pecas`,
    },
  ],
};

interface PageProps {
  searchParams: Promise<{ sort?: string }>;
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

export default async function TodasAsPecasPage({ searchParams }: PageProps) {
  const { sort } = await searchParams;
  const products = sortProducts(mockProducts, sort);

  return (
    <div className="container-luratha section-padding">
      <JsonLd data={collectionPageSchema} />
      <JsonLd data={breadcrumbSchema} />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Todas as Peças" },
        ]}
      />
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-heading)]">
            Todas as Peças
          </h1>
          <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/60 mt-1">
            {products.length}{" "}
            {products.length === 1
              ? "produto encontrado"
              : "produtos encontrados"}
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
