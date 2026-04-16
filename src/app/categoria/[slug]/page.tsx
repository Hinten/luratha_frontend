import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { FirestoreCategory, Product as FirestoreProduct } from "@/src/schemas/firestore";
import { Product } from "@/src/lib/types";
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

const DEFAULT_PRODUCT_IMAGE_URL = "https://placehold.co/600x750/F8F5F0/3A2F2A?text=Produto";
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

const getCachedCategoryProducts = cache(async (categorySlug: string): Promise<Product[]> => {
  try {
    const products = await productsRepository.list({
      status: "active",
      categorySlug,
      limit: 100,
    });

    return products.map((product) => mapFirestoreProductToCard(product, categorySlug));
  } catch (error) {
    console.error(`[CategoriaPage] error fetching products for category "${categorySlug}"`, error);
    throw createHttpStatusError(500, "Erro ao carregar produtos da categoria no banco.");
  }
});

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
      title: `${category.name} Artesanais | Luratha`,
      description: `Explore a coleção de ${category.name.toLowerCase()} artesanais da Luratha — slow fashion feminino brasileiro.`,
      url: categoryUrl,
      type: "website",
      images: [DEFAULT_OG_IMAGE],
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

  const category = await getCachedCategoryBySlug(slug);
  if (!category) return notFound();

  const firestoreProducts = await getCachedCategoryProducts(slug);
  const products = sortProducts(firestoreProducts, sort);

  const categoryUrl = `${SITE_URL}/categoria/${slug}`;

  const collectionPageSchema = {
    "@context": "https://schema.org" as const,
    "@type": "CollectionPage",
    name: `${category.name} Artesanais | Luratha`,
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

function mapFirestoreProductToCard(product: FirestoreProduct, categorySlug: string): Product {
  const imageUrl = product.photoIds[0]?.trim() || DEFAULT_PRODUCT_IMAGE_URL;
  const currentPrice = product.price.salePrice ?? product.price.price;
  const productCategorySlug = product.category[0]?.slug;

  return {
    id: product.id,
    name: product.title,
    slug: product.slug,
    categorySlug: productCategorySlug ?? categorySlug,
    price: currentPrice,
    originalPrice: product.price.salePrice ? product.price.price : undefined,
    imageUrl,
    rating: product.ratingAverage ?? undefined,
    reviewCount: product.reviewCount ?? undefined,
  };
}

function createHttpStatusError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
