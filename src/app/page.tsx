import HeroBanner from "@/src/components/HeroBanner";
import CategoryBlock from "@/src/components/CategoryBlock";
import ProductSection from "@/src/components/ProductSection";
import ProductCard from "@/src/components/ProductCard";
import {
  mockCategories,
  mockNewArrivals,
  mockFeatured,
  mockSale,
} from "@/src/lib/mockData";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main>
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

