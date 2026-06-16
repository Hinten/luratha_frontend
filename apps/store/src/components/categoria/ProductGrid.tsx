import type { Product, Stock } from "@luratha/schemas";
import styles from "./ProductGrid.module.css";
import ProductCard from "../produto/ProductCard";
import ViewItemListTracker from "@/src/components/analytics/ViewItemListTracker";
import SelectItemTracker from "@/src/components/analytics/SelectItemTracker";

interface ProductGridProps {
  products: Product[];
  stockMap?: Map<string, Stock>;
  /** Nome da lista p/ o evento `view_item_list` (ex.: nome da categoria). */
  listName?: string;
}

export default function ProductGrid({ products, stockMap, listName }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyHeading}>Nenhuma peça encontrada</p>
        <p className={styles.emptyBody}>Tente explorar outras categorias ou volte em breve.</p>
      </div>
    );
  }

  return (
    <div className={styles.grid} data-testid="product-grid">
      <ViewItemListTracker products={products} listName={listName} />
      {products.map((product, index) => (
        <SelectItemTracker key={product.id} product={product} listName={listName} index={index}>
          <ProductCard product={product} stock={stockMap?.get(product.id)} />
        </SelectItemTracker>
      ))}
    </div>
  );
}
