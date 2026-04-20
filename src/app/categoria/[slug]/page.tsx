import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { FirestoreCategory } from "@/src/schemas/firestore";
import Breadcrumb from "@/src/components/Breadcrumb";
import ProductGrid from "@/src/components/categoria/ProductGrid";
import SortDropdown from "@/src/components/categoria/SortDropdown";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, DEFAULT_OG_IMAGE, LURATHA_SCHEMA } from "@/src/lib/seoConstants";
import { dbServer } from "@/src/lib/firestore/firebaseServer";
import { createCategoriesRepository } from "@/src/lib/repositories/categoriesRepository";
import { createProductsSearchRepository } from "@/src/lib/repositories/productsSearchRepository";
import type { ProductSearchFilters, ProductSort } from "@/src/lib/firestoreQueryStrategies";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    q?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    tags?: string;
    page?: string;
  }>;
}

const categoriesRepository = createCategoriesRepository(dbServer);
const productsSearchRepository = createProductsSearchRepository(dbServer);

const getCachedCategoryBySlug = cache(async (slug: string): Promise<FirestoreCategory | null> => {
  try {
    return await categoriesRepository.getBySlug(slug);
  } catch (error) {
    console.error(`[CategoriaPage] error fetching category with slug "${slug}"`, error);
    throw createHttpStatusError(500, "Erro ao carregar dados da categoria no banco.");
  }
});

const getCachedCategoryProducts = cache(
  async (category: FirestoreCategory, filters: ProductSearchFilters) => {
    try {
      return await productsSearchRepository.search({
        ...filters,
        categorySlug: category.slug,
      });
    } catch (error) {
      console.error(`[CategoriaPage] error fetching products for category "${category.slug}"`, error);
      throw createHttpStatusError(500, "Erro ao carregar produtos da categoria no banco.");
    }
  },
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCachedCategoryBySlug(slug);
  if (!category) return {};
  const categoryUrl = `${SITE_URL}/categoria/${slug}`;
  return {
    title: `${category.name} Artesanais`,
    description: `Explore a coleção de ${category.name.toLowerCase()} artesanais da Luratha — slow fashion feminino brasileiro feito com amor e cuidado.`,
    alternates: { canonical: categoryUrl },
    openGraph: {
      title: `${category.name} | Luratha`,
      description: `Explore a coleção de ${category.name.toLowerCase()} artesanais da Luratha — slow fashion feminino brasileiro.`,
      url: categoryUrl,
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const parsedParams = parseSearchParams(await searchParams);

  const category = await getCachedCategoryBySlug(slug);
  if (!category) return notFound();

  const products = await getCachedCategoryProducts(category, parsedParams);

  const categoryUrl = `${SITE_URL}/categoria/${slug}`;

  const collectionPageSchema = {
    "@context": "https://schema.org" as const,
    "@type": "CollectionPage",
    name: `${category.name} | Luratha`,
    description: `Explore a coleção de ${category.name.toLowerCase()} artesanais da Luratha — slow fashion feminino brasileiro.`,
    url: categoryUrl,
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
        name: category.name,
        item: categoryUrl,
      },
    ],
  };

  return (
    <div className="container-luratha section-padding">
      <JsonLd data={collectionPageSchema} />
      <JsonLd data={breadcrumbSchema} />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: category.name },
        ]}
      />
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-heading)]">
            {category.name}
          </h1>
          <p
            aria-live="polite"
            className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/60 mt-1"
          >
            {products.length}{" "}
            {products.length === 1 ? "produto encontrado" : "produtos encontrados"}
          </p>
        </div>
        <Suspense fallback={null}>
          <SortDropdown currentSort={parsedParams.sort ? toDropdownSort(parsedParams.sort) : "recentes"} />
        </Suspense>
      </div>
      <ProductGrid products={products} />
    </div>
  );
}

function createHttpStatusError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
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
  const sort = toQuerySort(searchParams.sort);
  const minPrice = parseNumber(searchParams.minPrice);
  const maxPrice = parseNumber(searchParams.maxPrice);
  const tags = parseTags(searchParams.tags);

  return {
    term: searchParams.q?.trim() || undefined,
    minPrice,
    maxPrice,
    tags,
    sort,
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
