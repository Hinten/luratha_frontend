import ProductCard from "@/src/components/produto/ProductCard";
import type { Product } from "@/src/lib/types";
import styles from "./ProductSection.module.css";

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
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

