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
  title: "Promoções",
  description:
    "Peças slow fashion artesanais Luratha com desconto especial. Aproveite ofertas em vestidos, blusas, calças e muito mais.",
  alternates: { canonical: `${SITE_URL}/sale` },
  openGraph: {
    title: "Promoções | Luratha",
    description:
      "Peças slow fashion artesanais Luratha com desconto especial. Aproveite as ofertas.",
    url: `${SITE_URL}/sale`,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

const offerCatalogSchema = {
  "@context": "https://schema.org" as const,
  "@type": "OfferCatalog",
  name: "Promoções Luratha",
  description: "Peças slow fashion artesanais Luratha com desconto especial.",
  url: `${SITE_URL}/sale`,
  seller: {
    "@type": "Organization",
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
      name: "Promoções",
      item: `${SITE_URL}/sale`,
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

export default async function SalePage({ searchParams }: PageProps) {
  const { sort } = await searchParams;
  const saleProducts = buildMockProducts().filter((product) => product.price.salePrice !== null);
  const products = sortProducts(saleProducts, sort);

  return (
    <div className="container-luratha section-padding">
      <JsonLd data={offerCatalogSchema} />
      <JsonLd data={breadcrumbSchema} />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Promoções" },
        ]}
      />
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-heading)]">Promoções</h1>
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

function getCurrentPrice(product: FirestoreProduct): number {
  return product.price.salePrice ?? product.price.price;
}

function getOriginalPrice(product: FirestoreProduct): number | undefined {
  return product.price.salePrice ? product.price.price : undefined;
}
