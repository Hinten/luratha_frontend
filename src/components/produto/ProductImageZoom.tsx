"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ProductImageZoom.module.css";

interface ProductImageZoomProps {
  src: string;
  srcSet: string;
  sizes: string;
  alt: string;
  zoomUrl?: string | null;
  onSwipeNext?: () => void;
  onSwipePrevious?: () => void;
}

export default function ProductImageZoom({
  src,
  srcSet,
  sizes,
  alt,
  zoomUrl,
  onSwipeNext,
  onSwipePrevious,
}: ProductImageZoomProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        className={`${styles.mainImage} ${zoomUrl ? styles.zoomableImage : ""}`}
        onPointerDown={(event) => {
          pointerStartRef.current = { x: event.clientX, y: event.clientY };
          draggedRef.current = false;
        }}
        onPointerMove={(event) => {
          if (!pointerStartRef.current) {
            return;
          }

          const deltaX = event.clientX - pointerStartRef.current.x;
          const deltaY = event.clientY - pointerStartRef.current.y;
          if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
            draggedRef.current = true;
          }
        }}
        onPointerUp={(event) => {
          const startPoint = pointerStartRef.current;
          pointerStartRef.current = null;
          if (!startPoint) {
            return;
          }

          const deltaX = event.clientX - startPoint.x;
          const deltaY = event.clientY - startPoint.y;

          if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
            draggedRef.current = true;
            if (deltaX < 0) {
              onSwipeNext?.();
            } else {
              onSwipePrevious?.();
            }
            return;
          }

          if (!draggedRef.current && zoomUrl) {
            setIsOpen(true);
          }
        }}
        onPointerCancel={() => {
          pointerStartRef.current = null;
          draggedRef.current = false;
        }}
      />
      {zoomUrl && (
        <>
          {process.env.NODE_ENV === "development" && (
            <span className={styles.zoomDevFlag} aria-hidden="true">
              Zoom disponível (dev)
            </span>
          )}
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
