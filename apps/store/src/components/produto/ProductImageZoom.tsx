"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ImageWithFallback from "@/src/components/ImageWithFallback";
import styles from "./ProductImageZoom.module.css";

const CAN_USE_PORTAL = typeof document !== "undefined";

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
  const [mainImageErrored, setMainImageErrored] = useState(false);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  // Reset load/error state when the gallery switches to another image.
  if (src !== prevSrc) {
    setPrevSrc(src);
    setMainImageErrored(false);
    setMainImageLoaded(false);
  }
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);

  const useFallback = !src || mainImageErrored;
  const canZoom = !useFallback && Boolean(zoomUrl);

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
      {useFallback ? (
        <ImageWithFallback src={null} alt={alt} fill sizes={sizes} className={styles.mainImage} />
      ) : (
        <>
          {!mainImageLoaded && <div className={styles.skeleton} aria-hidden="true" />}
          {/* Uses pre-rendered Firebase Storage variants via custom srcSet — next/image's optimizer would replace them with on-the-fly resizes of the desktop variant. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={(node) => {
              if (node?.complete) {
                setMainImageLoaded(true);
              }
            }}
            src={src}
            srcSet={srcSet}
            sizes={sizes}
            alt={alt}
            decoding="async"
            fetchPriority="high"
            onLoad={() => setMainImageLoaded(true)}
            onError={() => setMainImageErrored(true)}
            className={`${styles.mainImage} ${mainImageLoaded ? "" : styles.imageLoading} ${canZoom ? styles.zoomableImage : ""}`}
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

              if (!draggedRef.current && canZoom) {
                setIsOpen(true);
              }
            }}
            onPointerCancel={() => {
              pointerStartRef.current = null;
              draggedRef.current = false;
            }}
          />
        </>
      )}
      {canZoom && (
        <>
          {process.env.NODE_ENV === "development" && (
            <span className={styles.zoomDevFlag} aria-hidden="true">
              Zoom disponível (dev)
            </span>
          )}
          {isOpen &&
            CAN_USE_PORTAL &&
            createPortal(
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
                {/* Modal renders the image at viewport-bounded size (max-width/max-height with object-fit:contain) — intrinsic dimensions are unknown here and next/image requires explicit width/height or a fixed-aspect parent. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={zoomUrl ?? ""} alt={alt} className={styles.zoomedImage} />
              </div>,
              document.body,
            )}
        </>
      )}
    </>
  );
}
