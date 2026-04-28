import ProductCard from "@/src/components/produto/ProductCard";
import type { Product, Stock } from "@/src/schemas/firestore";
import styles from "./ProductSection.module.css";

interface ProductSectionProps {
  title: string;
  products: Product[];
  viewAllHref?: string;
  viewAllLabel?: string;
  stockMap?: Map<string, Stock>;
}

export default function ProductSection({
  title,
  products,
  viewAllHref,
  viewAllLabel = "Ver todos",
  stockMap,
}: ProductSectionProps) {
  return (
    <section className="section-padding">
      <div className="container-luratha">
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {viewAllHref && (
            <a href={viewAllHref} className={styles.viewAll}>
              {viewAllLabel}
            </a>
          )}
        </div>

        <div className={styles.grid}>
          {products.map((product) => (
            <ProductCard key={product.id} product={product} stock={stockMap?.get(product.id)} />
          ))}
        </div>
      </div>
    </section>
  );
}
