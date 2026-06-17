import { Suspense } from "react";
import type { Metadata } from "next";
import type { Firestore } from "firebase/firestore";
import Breadcrumb from "@/src/components/Breadcrumb";
import ProductGrid from "@/src/components/categoria/ProductGrid";
import SortDropdown from "@/src/components/categoria/SortDropdown";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, DEFAULT_OG_IMAGE, LURATHA_SCHEMA } from "@/src/lib/seoConstants";
import { getAuthenticatedAppForUser } from "@luratha/firestore/firebaseSsrApp";
import { createProductsSearchRepository } from "@luratha/repositories/productsSearchRepository";
import { createStockRepository } from "@luratha/repositories/stockRepository";
import type { ProductSearchFilters, ProductSort } from "@luratha/core/firestoreQueryStrategies";
import type { Product, Stock } from "@luratha/schemas";

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

const searchResponseCache = new Map<string, Promise<Product[]>>();
const MAX_SEARCH_CACHE_ENTRIES = 200;

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

async function getCachedSearchResults(cacheKey: string, firestore: Firestore): Promise<Product[]> {
  const productsSearchRepository = createProductsSearchRepository(firestore);

  const cached = searchResponseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = productsSearchRepository
    .search(parseSearchFiltersCacheKey(cacheKey))
    .then((results) => {
      // Do not cache empty/error results so the next request retries Firestore.
      // This prevents stale empty caches (e.g. before seeding) from masking real data.
      if (results.length === 0) {
        searchResponseCache.delete(cacheKey);
      }
      return results;
    })
    .catch((error) => {
      searchResponseCache.delete(cacheKey);
      throw error;
    });

  if (searchResponseCache.size >= MAX_SEARCH_CACHE_ENTRIES) {
    const oldestKey = searchResponseCache.keys().next().value;
    if (oldestKey) {
      searchResponseCache.delete(oldestKey);
    }
  }
  searchResponseCache.set(cacheKey, promise);

  return promise;
}

export default async function BuscaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseSearchParams(params);
  const term = filters.term ?? "";
  const canonical = `${SITE_URL}/busca${term ? `?q=${encodeURIComponent(term)}` : ""}`;

  let products: Product[] = [];
  let stockMap = new Map<string, Stock>();

  if (term) {
    const { firestore } = await getAuthenticatedAppForUser();
    products = await getCachedSearchResults(createSearchFiltersCacheKey(filters), firestore);
    if (products.length > 0) {
      const stockRepository = createStockRepository(firestore);
      stockMap = await stockRepository.getByProductIds(products.map((p) => p.id));
    }
  }

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

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            id="search-results-heading"
            tabIndex={-1}
            className="font-[family-name:var(--font-heading)]"
          >
            {term ? `Resultados para: ${term}` : "Buscar peças Luratha"}
          </h1>
          {term ? (
            <p
              aria-live="polite"
              className="mt-1 font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/60"
            >
              {products.length}{" "}
              {products.length === 1 ? "produto encontrado" : "produtos encontrados"}
            </p>
          ) : (
            <p className="mt-1 font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/60">
              Digite um termo no campo de busca para encontrar produtos por nome, descrição e
              estilo.
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
        <ProductGrid products={products} stockMap={stockMap} listName="Resultados de busca" />
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

function createSearchFiltersCacheKey(filters: ProductSearchFilters): string {
  return JSON.stringify({
    term: filters.term ?? "",
    sort: filters.sort ?? "newest",
    minPrice: filters.minPrice ?? null,
    maxPrice: filters.maxPrice ?? null,
    tags: filters.tags ?? [],
    limit: filters.limit ?? 24,
    offset: filters.offset ?? 0,
  });
}

function parseSearchFiltersCacheKey(cacheKey: string): ProductSearchFilters {
  const parsed = JSON.parse(cacheKey) as {
    term: string;
    sort: ProductSort;
    minPrice: number | null;
    maxPrice: number | null;
    tags: string[];
    limit: number;
    offset: number;
  };

  return {
    term: parsed.term || undefined,
    sort: parsed.sort,
    minPrice: parsed.minPrice ?? undefined,
    maxPrice: parsed.maxPrice ?? undefined,
    tags: parsed.tags.length ? parsed.tags : undefined,
    limit: parsed.limit,
    offset: parsed.offset,
  };
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
