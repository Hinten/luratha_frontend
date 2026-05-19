"use client";

import { useMemo, useState } from "react";
import type { Product as FirestoreProduct, Stock } from "@luratha/schemas";
import ProductGallery from "@/src/components/produto/ProductGallery";
import PriceBlock from "@/src/components/produto/PriceBlock";
import SizeSelector from "@/src/components/produto/SizeSelector";
import ShippingEstimator from "@/src/components/produto/ShippingEstimator";
import ProductHighlights from "@/src/components/produto/ProductHighlights";
import { getVariantGalleryImages } from "@/src/lib/productImages";
import styles from "./ProductDetailPage.module.css";

interface ProductVariantViewProps {
  product: FirestoreProduct;
  stock?: Stock | null;
  currentPrice: number;
  originalPrice?: number;
  highlights: string[];
  fallbackUrl: string;
}

export default function ProductVariantView({
  product,
  stock,
  currentPrice,
  originalPrice,
  highlights,
  fallbackUrl,
}: ProductVariantViewProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const images = useMemo(
    () => getVariantGalleryImages(product, selectedColor, selectedSize, fallbackUrl),
    [product, selectedColor, selectedSize, fallbackUrl],
  );

  return (
    <div className={styles.productLayout}>
      <div className={styles.galleryCol}>
        <ProductGallery images={images} productName={product.title} />
      </div>

      <div className={styles.infoCol}>
        <h1 className={styles.productName}>{product.title}</h1>

        {product.ratingAverage !== null && (
          <div className={styles.ratingRow}>
            <span className={styles.ratingStar} aria-hidden="true">
              ★
            </span>
            <span className={styles.ratingValue}>
              {product.ratingAverage.toFixed(1)}
            </span>
            {product.reviewCount !== null && (
              <span className={styles.ratingCount}>
                ({product.reviewCount} {product.reviewCount === 1 ? "avaliação" : "avaliações"})
              </span>
            )}
          </div>
        )}

        <div className={styles.priceWrapper}>
          <PriceBlock price={currentPrice} originalPrice={originalPrice} />
        </div>

        <SizeSelector
          product={product}
          stock={stock}
          productId={product.id}
          slug={product.slug}
          imageUrl={images[0]?.defaultUrl ?? fallbackUrl}
          price={currentPrice}
          onColorChange={setSelectedColor}
          onSizeChange={setSelectedSize}
        />

        <ShippingEstimator productPrice={currentPrice} />

        {highlights.length > 0 && <ProductHighlights highlights={highlights} />}
      </div>
    </div>
  );
}
