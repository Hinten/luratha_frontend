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

export default function Home() {
  return (
    <main>
      {/* 1. Hero Section */}
      <HeroBanner />

      {/* 2. Category Quick-Access */}
      <section className="section-padding bg-[var(--color-neutral-light)]">
        <div className="container-luratha">
          <h2 className="font-[family-name:var(--font-heading)] text-[var(--color-neutral-dark)] text-center mb-10">
            Explore por categoria
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
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
      <section className="bg-[var(--color-accent)]">
        <ProductSection
          title="Destaques"
          products={mockFeatured}
          viewAllHref="/colecao"
          viewAllLabel="Ver todos os destaques"
        />
      </section>

      {/* 5. Sale Section */}
      <section className="section-padding bg-[var(--color-neutral-light)]">
        <div className="container-luratha">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="inline-block text-xs font-medium uppercase tracking-widest text-[var(--color-primary)] mb-2">
                Ofertas especiais
              </span>
              <h2 className="font-[family-name:var(--font-heading)] text-[var(--color-neutral-dark)]">
                SALE até 50% OFF
              </h2>
            </div>
            <a
              href="/sale"
              className="font-[family-name:var(--font-body)] text-sm font-medium text-[var(--color-neutral-dark)] hover:text-[var(--color-primary)] transition-colors duration-300 underline-offset-4 hover:underline"
            >
              Ver ofertas
            </a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {mockSale.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
