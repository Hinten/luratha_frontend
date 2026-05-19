import type { Product, Stock } from "@luratha/schemas";
import styles from "./ProductGrid.module.css";
import ProductCard from "../produto/ProductCard";

interface ProductGridProps {
  products: Product[];
  stockMap?: Map<string, Stock>;
}

export default function ProductGrid({ products, stockMap }: ProductGridProps) {
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
        <ProductCard key={product.id} product={product} stock={stockMap?.get(product.id)} />
      ))}
    </div>
  );
}
