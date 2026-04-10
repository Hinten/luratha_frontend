"use client";

import { useState } from "react";
import styles from "./ProductGallery.module.css";

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export default function ProductGallery({
  images,
  productName,
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className={styles.gallery}>
      <div className={styles.mainWrapper}>
        <img
          src={images[activeIndex]}
          alt={`${productName} — imagem ${activeIndex + 1}`}
          className={styles.mainImage}
        />
      </div>
      {images.length > 1 && (
        <div className={styles.thumbnails} role="list" aria-label="Miniaturas do produto">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.thumbBtn} ${i === activeIndex ? styles.thumbActive : ""}`}
              onClick={() => setActiveIndex(i)}
              aria-label={`Ver imagem ${i + 1}`}
              aria-pressed={i === activeIndex}
            >
              <img
                src={src}
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
