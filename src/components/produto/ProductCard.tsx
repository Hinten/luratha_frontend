import Link from "next/link";
import styles from "./ProductCard.module.css";
import type { Product, Stock } from "@/src/schemas/firestore";
import { getProductCardImage, productCardImageSizes } from "@/src/lib/productImages";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const DEFAULT_PRODUCT_IMAGE_URL = "https://placehold.co/600x750/F8F5F0/3A2F2A?text=Produto";

interface ProductCardProps {
  product: Product;
  stock?: Stock | null;
}

export default function ProductCard({ product, stock }: ProductCardProps) {
  const name = product.title;
  const currentPrice = product.price.salePrice ?? product.price.price;
  const originalPrice = product.price.salePrice ? product.price.price : undefined;
  const imageUrl = getProductCardImage(product, DEFAULT_PRODUCT_IMAGE_URL);
  const rating = product.ratingAverage ?? undefined;
  const reviewCount = product.reviewCount ?? undefined;
  const slug = product.slug;

  const discountPct = originalPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : 0;

  // Prefer authoritative stock-collection data; fall back to the denormalised product field
  const effectiveStock = stock?.quantity ?? product.totalStock;
  const isOutOfStock = effectiveStock === 0;
  const isLowStock = !isOutOfStock && effectiveStock <= 3;

  const cardBody = (
    <>
      <div className={styles.imageWrapper}>
        <img
          src={imageUrl}
          alt={name}
          className={styles.image}
          loading="lazy"
          sizes={productCardImageSizes}
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
          <span className={styles.currentPrice}>{formatBRL(currentPrice)}</span>
        </div>
        {isLowStock && (
          <span className={styles.lowStockText}>
            Últimas {effectiveStock} unid.
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className={styles.card}>
      {discountPct > 0 && !isOutOfStock && (
        <span className={styles.discountBadge}>-{discountPct}%</span>
      )}
      {isOutOfStock && (
        <span className={styles.outOfStockBadge}>Esgotado</span>
      )}
      <button
        className={styles.favoriteBtn}
        aria-label="Adicionar aos favoritos"
        type="button"
      >
        ♡
      </button>
      {slug ? (
        <Link href={`/produto/${slug}`} className={styles.cardLink} aria-label={name}>
          {cardBody}
        </Link>
      ) : (
        cardBody
      )}
    </div>
  );
}
