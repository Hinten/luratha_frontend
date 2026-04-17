"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ProductImageZoom.module.css";

interface ProductImageZoomProps {
  src: string;
  srcSet: string;
  sizes: string;
  alt: string;
  zoomUrl?: string | null;
}

export default function ProductImageZoom({
  src,
  srcSet,
  sizes,
  alt,
  zoomUrl,
}: ProductImageZoomProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <>
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        className={styles.mainImage}
      />
      {zoomUrl && (
        <>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label="Ampliar imagem"
            onClick={() => setIsOpen(true)}
          >
            Zoom
          </button>
          {isOpen && (
            <div
              className={styles.overlay}
              role="dialog"
              aria-modal="true"
              aria-label="Imagem ampliada"
              onKeyDown={(event) => {
                if (event.key === "Tab") {
                  event.preventDefault();
                  closeButtonRef.current?.focus();
                }
              }}
            >
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                aria-label="Fechar zoom"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
              <img src={zoomUrl} alt={alt} className={styles.zoomedImage} />
            </div>
          )}
        </>
      )}
    </>
  );
}
