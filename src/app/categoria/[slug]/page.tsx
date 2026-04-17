import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { FirestoreCategory, Product as FirestoreProduct } from "@/src/schemas/firestore";
import Breadcrumb from "@/src/components/Breadcrumb";
import ProductGrid from "@/src/components/categoria/ProductGrid";
import SortDropdown from "@/src/components/categoria/SortDropdown";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, DEFAULT_OG_IMAGE, LURATHA_SCHEMA } from "@/src/lib/seoConstants";
import { dbServer } from "@/src/lib/firebaseServer";
import { createCategoriesRepository } from "@/src/lib/repositories/categoriesRepository";
import { createProductsRepository } from "@/src/lib/repositories/productsRepository";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}

const categoriesRepository = createCategoriesRepository(dbServer);
const productsRepository = createProductsRepository(dbServer);

const getCachedCategoryBySlug = cache(async (slug: string): Promise<FirestoreCategory | null> => {
  try {
    return await categoriesRepository.getBySlug(slug);
  } catch (error) {
    console.error(`[CategoriaPage] error fetching category with slug "${slug}"`, error);
    throw createHttpStatusError(500, "Erro ao carregar dados da categoria no banco.");
  }
});

const getCachedCategoryProducts = cache(async (category: FirestoreCategory): Promise<FirestoreProduct[]> => {
  try {
    return await productsRepository.list({
      status: "active",
      categoryId: category.id,
      limit: 100,
    });
  } catch (error) {
    console.error(`[CategoriaPage] error fetching products for category "${category.slug}"`, error);
    throw createHttpStatusError(500, "Erro ao carregar produtos da categoria no banco.");
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCachedCategoryBySlug(slug);
  if (!category) return {};
  const categoryUrl = `${SITE_URL}/categoria/${slug}`;
  return {
    title: `${category.name}`,
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

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { sort } = await searchParams;

  const category = await getCachedCategoryBySlug(slug);
  if (!category) return notFound();

  const firestoreProducts = await getCachedCategoryProducts(category);
  const products = sortProducts(firestoreProducts, sort);

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

function createHttpStatusError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function getCurrentPrice(product: FirestoreProduct): number {
  return product.price.salePrice ?? product.price.price;
}

function getOriginalPrice(product: FirestoreProduct): number | undefined {
  return product.price.salePrice ? product.price.price : undefined;
}
