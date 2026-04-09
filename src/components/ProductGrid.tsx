import ProductCard from "./ProductCard";
import type { Product } from "@/src/lib/types";
import styles from "./ProductGrid.module.css";

interface ProductGridProps {
  products: Product[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyHeading}>Nenhuma peça encontrada</p>
        <p className={styles.emptyBody}>
          Tente explorar outras categorias ou volte em breve.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.grid} data-testid="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

