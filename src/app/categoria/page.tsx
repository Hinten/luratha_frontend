import type { Metadata } from "next";
import Breadcrumb from "@/src/components/Breadcrumb";
import CategoryBlock from "@/src/components/categoria/CategoryBlock";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, DEFAULT_OG_IMAGE, LURATHA_SCHEMA } from "@/src/lib/seoConstants";
import { getCachedCategories } from "@/src/lib/queries/getCachedCategories";

const PAGE_URL = `${SITE_URL}/categoria`;

export const metadata: Metadata = {
  title: "Categorias",
  description:
    "Explore todas as categorias da Luratha — vestidos, blusas, calças, saias e muito mais. Slow fashion artesanal feminino brasileiro.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Categorias | Luratha",
    description:
      "Explore todas as categorias da Luratha — slow fashion artesanal feminino brasileiro.",
    url: PAGE_URL,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

const collectionPageSchema = {
  "@context": "https://schema.org" as const,
  "@type": "CollectionPage",
  name: "Categorias – Luratha",
  description:
    "Explore todas as categorias da Luratha — slow fashion artesanal feminino brasileiro.",
  url: PAGE_URL,
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
      name: "Categorias",
      item: PAGE_URL,
    },
  ],
};

export default async function CategoriaPage() {
  const categories = await getCachedCategories();

  return (
    <div className="container-luratha section-padding">
      <JsonLd data={collectionPageSchema} />
      <JsonLd data={breadcrumbSchema} />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Categorias" },
        ]}
      />
      <h1 className="font-[family-name:var(--font-heading)] mb-2">
        Categorias
      </h1>
      <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/60 mb-8">
        {categories.length}{" "}
        {categories.length === 1 ? "categoria disponível" : "categorias disponíveis"}
      </p>

      {categories.length === 0 ? (
        <p className="font-[family-name:var(--font-body)] text-[var(--color-neutral-dark)]/60">
          Nenhuma categoria encontrada no momento. Volte em breve!
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
          {categories.map((category) => (
            <CategoryBlock key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
