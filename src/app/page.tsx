import type { Metadata } from "next";
import HeroBanner from "@/src/components/HeroBanner";
import CategoryBlock from "@/src/components/CategoryBlock";
import ProductSection from "@/src/components/ProductSection";
import ProductCard from "@/src/components/ProductCard";
import JsonLd from "@/src/components/JsonLd";
import {
  mockCategories,
  mockNewArrivals,
  mockFeatured,
  mockSale,
} from "@/src/lib/mockData";
import { SITE_URL, LURATHA_SCHEMA, DEFAULT_OG_IMAGE } from "@/src/lib/seoConstants";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: { absolute: "Luratha – Moda Artesanal Feminina" },
  description:
    "Descubra peças slow fashion artesanais brasileiras feitas com amor para durar. Vestidos, blusas, calças e muito mais na Luratha.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Luratha – Moda Artesanal Feminina",
    description:
      "Descubra peças slow fashion artesanais brasileiras feitas com amor para durar.",
    url: SITE_URL,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

const homePageSchema = {
  "@context": "https://schema.org" as const,
  "@type": "WebPage",
  name: "Luratha – Moda Artesanal Feminina",
  description:
    "Descubra peças slow fashion artesanais brasileiras feitas com amor para durar. Vestidos, blusas, calças e muito mais na Luratha.",
  url: SITE_URL,
  isPartOf: {
    "@type": "WebSite",
    name: LURATHA_SCHEMA.name,
    url: LURATHA_SCHEMA.url,
  },
  publisher: {
    "@type": "Organization",
    name: LURATHA_SCHEMA.name,
    logo: {
      "@type": "ImageObject",
      url: LURATHA_SCHEMA.logo,
    },
  },
};

export default function Home() {
  return (
    <main>
      <JsonLd data={homePageSchema} />
      {/* 1. Hero Section */}
      <HeroBanner />

      {/* 2. Category Quick-Access */}
      <section className="section-padding">
        <div className="container-luratha">
          <h2 className={styles.categoriesHeading}>Explore por categoria</h2>
          <div className={styles.categoriesGrid}>
            {mockCategories.map((category) => (
              <CategoryBlock key={category.href} category={category} />
            ))}
          </div>
        </div>
      </section>

      {/* 3. Lançamentos */}
      <ProductSection
        title="Lançamentos"
        products={mockNewArrivals}
        viewAllHref="/colecao"
        viewAllLabel="Ver todos os lançamentos"
      />

      {/* 4. Destaques */}
      <div className={styles.destaquesBg}>
        <ProductSection
          title="Destaques"
          products={mockFeatured}
          viewAllHref="/colecao"
          viewAllLabel="Ver todos os destaques"
        />
      </div>

      {/* 5. Sale Section */}
      <section className={`section-padding ${styles.saleSection}`}>
        <div className="container-luratha">
          <div className={styles.saleHeader}>
            <div>
              <span className={styles.saleEyebrow}>Ofertas especiais</span>
              <h2 className={styles.saleTitle}>SALE até 50% OFF</h2>
            </div>
            <a href="/sale" className={styles.saleViewAll}>
              Ver ofertas
            </a>
          </div>
          <div className={styles.saleGrid}>
            {mockSale.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

