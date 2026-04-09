import ProductCard from "./ProductCard";
import type { Product } from "@/src/lib/types";

interface ProductGridProps {
  products: Product[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-neutral-dark)]/60 mb-2">
          Nenhuma peça encontrada
        </p>
        <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/40">
          Tente explorar outras categorias ou volte em breve.
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
      data-testid="product-grid"
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
