import type { Product } from "@/src/lib/types";
import styles from "./ProductCard.module.css";

interface ProductCardProps {
  product: Product;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function ProductCard({ product }: ProductCardProps) {
  const {
    name,
    price,
    originalPrice,
    imageUrl,
    rating,
    reviewCount,
    installments,
  } = product;

  const hasDiscount = originalPrice !== undefined && originalPrice > price;
  const discountPct = hasDiscount
    ? Math.round((1 - price / originalPrice!) * 100)
    : 0;

  return (
    <article className={styles.card}>
      {/* Discount badge */}
      {hasDiscount && (
        <span className={styles.discountBadge}>-{discountPct}%</span>
      )}

      {/* Favorite button */}
      <button aria-label={`Favoritar ${name}`} className={styles.favoriteBtn}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          width={20}
          height={20}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
          />
        </svg>
      </button>

      {/* Image */}
      <div className={styles.imageWrapper}>
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          className={styles.image}
        />
      </div>

      {/* Info */}
      <div className={styles.info}>
        <h3 className={styles.name}>{name}</h3>

        {/* Rating */}
        {rating !== undefined && (
          <div className={styles.rating}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="#E8B9C9"
              width={14}
              height={14}
            >
              <path
                fillRule="evenodd"
                d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{rating.toFixed(1)}</span>
            {reviewCount !== undefined && (
              <span className={styles.ratingCount}>({reviewCount})</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className={styles.priceBlock}>
          {hasDiscount && (
            <span className={styles.originalPrice}>{formatBRL(originalPrice!)}</span>
          )}
          <span className={styles.currentPrice}>{formatBRL(price)}</span>
          {installments && (
            <span className={styles.installments}>
              {installments.count}x {formatBRL(installments.value)} sem juros
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

