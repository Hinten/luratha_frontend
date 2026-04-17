"use client";

import { useState } from "react";
import styles from "./ProductGallery.module.css";
import ProductImageZoom from "./ProductImageZoom";
import type { ProductGalleryImage } from "@/src/lib/productImages";
import { productGalleryImageSizes } from "@/src/lib/productImages";

interface ProductGalleryProps {
  images: ProductGalleryImage[];
  productName: string;
}

export default function ProductGallery({
  images,
  productName,
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];

  return (
    <div className={styles.gallery}>
      <div className={styles.mainWrapper}>
        <ProductImageZoom
          src={activeImage.defaultUrl}
          srcSet={activeImage.srcSet}
          sizes={productGalleryImageSizes}
          alt={activeImage.alt || `${productName} — imagem ${activeIndex + 1}`}
          zoomUrl={activeImage.zoomUrl}
        />
      </div>
      {images.length > 1 && (
        <div className={styles.thumbnails} role="list" aria-label="Miniaturas do produto">
          {images.map((image, i) => (
            <button
              key={image.id}
              type="button"
              className={`${styles.thumbBtn} ${i === activeIndex ? styles.thumbActive : ""}`}
              onClick={() => setActiveIndex(i)}
              aria-label={`Ver imagem ${i + 1}`}
              aria-pressed={i === activeIndex}
            >
              <img
                src={image.defaultUrl}
                alt={`${productName} — miniatura ${i + 1}`}
                className={styles.thumbImage}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
