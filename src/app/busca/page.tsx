import { cache, Suspense } from "react";
import type { Metadata } from "next";
import Breadcrumb from "@/src/components/Breadcrumb";
import ProductGrid from "@/src/components/categoria/ProductGrid";
import SortDropdown from "@/src/components/categoria/SortDropdown";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, DEFAULT_OG_IMAGE, LURATHA_SCHEMA } from "@/src/lib/seoConstants";
import { dbServer } from "@/src/lib/firebaseServer";
import { createProductsSearchRepository } from "@/src/lib/repositories/productsSearchRepository";
import type { ProductSearchFilters, ProductSort } from "@/src/lib/firestoreQueryStrategies";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    tags?: string;
    page?: string;
  }>;
}

const productsSearchRepository = createProductsSearchRepository(dbServer);

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const term = q?.trim();
  const canonical = `${SITE_URL}/busca${term ? `?q=${encodeURIComponent(term)}` : ""}`;

  return {
    title: term ? `Busca: "${term}" | Luratha` : "Buscar | Luratha",
    description: `Encontre peças slow fashion na Luratha${term ? ` relacionadas a "${term}"` : ""}.`,
    alternates: { canonical },
    openGraph: {
      title: term ? `Busca: "${term}" | Luratha` : "Buscar | Luratha",
      description: `Encontre peças slow fashion na Luratha${term ? ` relacionadas a "${term}"` : ""}.`,
      url: canonical,
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    },
    robots: {
      index: false,
      follow: true,
    },
  };
}

const getCachedSearchResults = cache(async (filters: ProductSearchFilters) => {
  return productsSearchRepository.search(filters);
});

export default async function BuscaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseSearchParams(params);
  const term = filters.term ?? "";
  const products = term ? await getCachedSearchResults(filters) : [];
  const canonical = `${SITE_URL}/busca${term ? `?q=${encodeURIComponent(term)}` : ""}`;

  const searchResultsSchema = {
    "@context": "https://schema.org" as const,
    "@type": "SearchResultsPage",
    name: term ? `Resultados para: ${term}` : "Buscar produtos",
    url: canonical,
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
        name: "Busca",
        item: `${SITE_URL}/busca`,
      },
      ...(term
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: term,
              item: canonical,
            },
          ]
        : []),
    ],
  };

  return (
    <div className="container-luratha section-padding">
      <JsonLd data={searchResultsSchema} />
      <JsonLd data={breadcrumbSchema} />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Busca", href: "/busca" },
          ...(term ? [{ label: `"${term}"` }] : []),
        ]}
      />

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 id="search-results-heading" tabIndex={-1} className="font-[family-name:var(--font-heading)]">
            {term ? `Resultados para: ${term}` : "Buscar peças Luratha"}
          </h1>
          {term ? (
            <p
              aria-live="polite"
              className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/60 mt-1"
            >
              {products.length} {products.length === 1 ? "produto encontrado" : "produtos encontrados"}
            </p>
          ) : (
            <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/60 mt-1">
              Digite um termo no campo de busca para encontrar produtos por nome, descrição e estilo.
            </p>
          )}
        </div>
        {term ? (
          <Suspense fallback={null}>
            <SortDropdown currentSort={filters.sort ? toDropdownSort(filters.sort) : "recentes"} />
          </Suspense>
        ) : null}
      </div>

      {term ? (
        <ProductGrid products={products} />
      ) : (
        <section aria-label="Guia de busca">
          <p className="font-[family-name:var(--font-body)] text-[var(--color-neutral-dark)]/80">
            Experimente termos como “vestido de linho”, “blusa bordada” ou “conjunto casual”.
          </p>
        </section>
      )}
    </div>
  );
}

function parseSearchParams(searchParams: {
  q?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  tags?: string;
  page?: string;
}): ProductSearchFilters {
  const page = Number(searchParams.page ?? "1");
  const limit = 24;

  return {
    term: searchParams.q?.trim() || undefined,
    sort: toQuerySort(searchParams.sort),
    minPrice: parseNumber(searchParams.minPrice),
    maxPrice: parseNumber(searchParams.maxPrice),
    tags: parseTags(searchParams.tags),
    limit,
    offset: Number.isInteger(page) && page > 1 ? (page - 1) * limit : 0,
  };
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseTags(value?: string): string[] | undefined {
  if (!value) return undefined;
  const tags = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return tags.length ? tags : undefined;
}

function toQuerySort(sort?: string): ProductSort | undefined {
  switch (sort) {
    case "menor-preco":
      return "price_asc";
    case "maior-preco":
      return "price_desc";
    case "maior-desconto":
      return "rating_desc";
    default:
      return "newest";
  }
}

function toDropdownSort(sort: ProductSort): string {
  switch (sort) {
    case "price_asc":
      return "menor-preco";
    case "price_desc":
      return "maior-preco";
    case "rating_desc":
      return "maior-desconto";
    case "newest":
    default:
      return "recentes";
  }
}
