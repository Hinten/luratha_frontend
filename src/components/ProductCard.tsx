import styles from "./ProductCard.module.css";
import type { Product } from "@/src/lib/types";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { name, price, originalPrice, imageUrl, rating, reviewCount, installments } =
    product;

  const discountPct = originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  return (
    <div className={styles.card}>
      {discountPct > 0 && (
        <span className={styles.discountBadge}>-{discountPct}%</span>
      )}
      <button
        className={styles.favoriteBtn}
        aria-label="Adicionar aos favoritos"
        type="button"
      >
        ♡
      </button>
      <div className={styles.imageWrapper}>
        <img
          src={imageUrl}
          alt={name}
          className={styles.image}
          loading="lazy"
        />
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{name}</p>
        {rating !== undefined && (
          <div className={styles.rating}>
            <span>★ {rating.toFixed(1)}</span>
            {reviewCount !== undefined && (
              <span className={styles.ratingCount}>({reviewCount})</span>
            )}
          </div>
        )}
        <div className={styles.priceBlock}>
          {originalPrice !== undefined && (
            <span className={styles.originalPrice}>{formatBRL(originalPrice)}</span>
          )}
          <span className={styles.currentPrice}>{formatBRL(price)}</span>
          {installments && (
            <span className={styles.installments}>
              {installments.count}x {formatBRL(installments.value)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
