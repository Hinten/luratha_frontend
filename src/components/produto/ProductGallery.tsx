"use client";

import { useEffect, useRef, useState } from "react";
import ImageWithFallback from "@/src/components/ImageWithFallback";
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
  const [isDesktop, setIsDesktop] = useState(false);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const thumbnailsRef = useRef<HTMLDivElement | null>(null);
  const activeImage = images[activeIndex];

  useEffect(() => {
    const updateViewportMode = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);
    return () => {
      window.removeEventListener("resize", updateViewportMode);
    };
  }, []);

  useEffect(() => {
    const container = thumbnailsRef.current;
    if (!container) {
      return;
    }

    const selectedThumb = container.querySelector<HTMLButtonElement>(`[data-thumb-index="${activeIndex}"]`);
    if (selectedThumb && typeof selectedThumb.scrollIntoView === "function") {
      selectedThumb.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activeIndex]);

  useEffect(() => {
    const container = thumbnailsRef.current;
    if (!container) {
      return;
    }

    const updateScrollState = () => {
      if (isDesktop) {
        const max = container.scrollHeight - container.clientHeight;
        setCanScrollBack(container.scrollTop > 2);
        setCanScrollForward(max - container.scrollTop > 2);
      } else {
        const max = container.scrollWidth - container.clientWidth;
        setCanScrollBack(container.scrollLeft > 2);
        setCanScrollForward(max - container.scrollLeft > 2);
      }
    };

    updateScrollState();
    container.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);
    return () => {
      container.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [images.length, isDesktop]);

  const goToPreviousImage = () => {
    setActiveIndex((previous) => (previous - 1 + images.length) % images.length);
  };

  const goToNextImage = () => {
    setActiveIndex((previous) => (previous + 1) % images.length);
  };

  const scrollThumbnails = (direction: "backward" | "forward") => {
    const container = thumbnailsRef.current;
    if (!container) {
      return;
    }

    const amount = direction === "forward" ? 96 : -96;
    container.scrollBy(
      isDesktop
        ? { top: amount, behavior: "smooth" }
        : { left: amount, behavior: "smooth" },
    );
  };

  return (
    <div className={styles.gallery}>
      <div className={styles.mediaArea}>
        {images.length > 1 && (
          <div className={styles.thumbnailsRail}>
            {canScrollBack && (
              <button
                type="button"
                className={styles.thumbArrow}
                onClick={() => scrollThumbnails("backward")}
                aria-label={isDesktop ? "Subir miniaturas" : "Miniaturas anteriores"}
              >
                {isDesktop ? "↑" : "←"}
              </button>
            )}

            <div
              ref={thumbnailsRef}
              className={`${styles.thumbnails} ${isDesktop ? styles.thumbnailsDesktop : styles.thumbnailsMobile}`}
              role="list"
              aria-label="Miniaturas do produto"
            >
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  className={`${styles.thumbBtn} ${i === activeIndex ? styles.thumbActive : ""}`}
                  onClick={() => setActiveIndex(i)}
                  onMouseEnter={() => {
                    if (isDesktop) {
                      setActiveIndex(i);
                    }
                  }}
                  data-thumb-index={i}
                  aria-label={`Ver imagem ${i + 1}`}
                  aria-pressed={i === activeIndex}
                >
                  <ImageWithFallback
                    src={image.defaultUrl}
                    alt={`${productName} — miniatura ${i + 1}`}
                    width={64}
                    height={64}
                    sizes="64px"
                    className={styles.thumbImage}
                  />
                </button>
              ))}
            </div>

            {canScrollForward && (
              <button
                type="button"
                className={styles.thumbArrow}
                onClick={() => scrollThumbnails("forward")}
                aria-label={isDesktop ? "Descer miniaturas" : "Próximas miniaturas"}
              >
                {isDesktop ? "↓" : "→"}
              </button>
            )}
          </div>
        )}

        <div className={styles.mainWrapper}>
          <ProductImageZoom
            src={activeImage.defaultUrl}
            srcSet={activeImage.srcSet}
            sizes={productGalleryImageSizes}
            alt={activeImage.alt || `${productName} — imagem ${activeIndex + 1}`}
            zoomUrl={activeImage.zoomUrl}
            onSwipePrevious={goToPreviousImage}
            onSwipeNext={goToNextImage}
          />
        </div>
      </div>
    </div>
  );
}
