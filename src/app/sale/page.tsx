import { Suspense } from "react";
import type { Metadata } from "next";
import { mockProducts } from "@/src/lib/mockData";
import { Product } from "@/src/lib/types";
import Breadcrumb from "@/src/components/Breadcrumb";
import ProductGrid from "@/src/components/ProductGrid";
import SortDropdown from "@/src/components/SortDropdown";

export const metadata: Metadata = {
  title: "Promoções",
  description:
    "Aproveite peças slow fashion artesanais com desconto especial. Qualidade Luratha com preços imperdíveis.",
  alternates: { canonical: "https://www.luratha.com.br/sale" },
  openGraph: {
    title: "Promoções | Luratha",
    description:
      "Aproveite peças slow fashion artesanais com desconto especial. Qualidade Luratha com preços imperdíveis.",
    url: "https://www.luratha.com.br/sale",
    type: "website",
  },
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

export default async function SalePage({ searchParams }: PageProps) {
  const { sort } = await searchParams;
  const saleProducts = mockProducts.filter((p) => p.originalPrice !== undefined);
  const products = sortProducts(saleProducts, sort);

  return (
    <div className="container-luratha section-padding">
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
