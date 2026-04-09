import ProductCard from "@/src/components/ProductCard";
import type { Product } from "@/src/lib/types";

interface ProductSectionProps {
  title: string;
  products: Product[];
  viewAllHref?: string;
  viewAllLabel?: string;
}

export default function ProductSection({
  title,
  products,
  viewAllHref,
  viewAllLabel = "Ver todos",
}: ProductSectionProps) {
  return (
    <section className="section-padding">
      <div className="container-luratha">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <h2 className="font-[family-name:var(--font-heading)] text-[var(--color-neutral-dark)]">
            {title}
          </h2>
          {viewAllHref && (
            <a
              href={viewAllHref}
              className="font-[family-name:var(--font-body)] text-sm font-medium text-[var(--color-neutral-dark)] hover:text-[var(--color-primary)] transition-colors duration-300 underline-offset-4 hover:underline"
            >
              {viewAllLabel}
            </a>
          )}
        </div>

        {/* Scrollable grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
