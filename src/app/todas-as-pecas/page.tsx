import { Suspense } from "react";
import type { Metadata } from "next";
import type { Product as FirestoreProduct } from "@/src/schemas/firestore";
import Breadcrumb from "@/src/components/Breadcrumb";
import SortDropdown from "@/src/components/categoria/SortDropdown";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, DEFAULT_OG_IMAGE, LURATHA_SCHEMA } from "@/src/lib/seoConstants";
import ProductGrid from "@/src/components/categoria/ProductGrid";
import { buildMockProducts } from "@/src/lib/repositories/productsMockData";

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

function sortProducts(products: FirestoreProduct[], sort?: string): FirestoreProduct[] {
  const sorted = [...products];
  switch (sort) {
    case "menor-preco":
      return sorted.sort((a, b) => getCurrentPrice(a) - getCurrentPrice(b));
    case "maior-preco":
      return sorted.sort((a, b) => getCurrentPrice(b) - getCurrentPrice(a));
    case "maior-desconto":
      return sorted.sort((a, b) => {
        const originalPriceA = getOriginalPrice(a);
        const currentPriceA = getCurrentPrice(a);
        const discountA = originalPriceA
          ? (originalPriceA - currentPriceA) / originalPriceA
          : 0;
        const originalPriceB = getOriginalPrice(b);
        const currentPriceB = getCurrentPrice(b);
        const discountB = originalPriceB
          ? (originalPriceB - currentPriceB) / originalPriceB
          : 0;
        return discountB - discountA;
      });
    default:
      return sorted;
  }
}

export default async function TodasAsPecasPage({ searchParams }: PageProps) {
  const { sort } = await searchParams;
  const products = sortProducts(buildMockProducts(), sort);

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

function getCurrentPrice(product: FirestoreProduct): number {
  return product.price.salePrice ?? product.price.price;
}

function getOriginalPrice(product: FirestoreProduct): number | undefined {
  return product.price.salePrice ? product.price.price : undefined;
}
