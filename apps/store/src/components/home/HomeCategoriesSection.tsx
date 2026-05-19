"use client";

import { useEffect, useRef, useState } from "react";
import CategoryBlock from "@/src/components/categoria/CategoryBlock";
import type { Category } from "@luratha/schemas/category";
import styles from "./HomeCategoriesSection.module.css";

const SCROLL_THRESHOLD = 1;
const SCROLL_AMOUNT_PERCENTAGE = 0.8;

interface HomeCategoriesSectionProps {
  categories: Category[];
}

export default function HomeCategoriesSection({
  categories,
}: HomeCategoriesSectionProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateScrollState = () => {
      const maxScrollLeft = track.scrollWidth - track.clientWidth;
      const effectiveMaxScroll = maxScrollLeft - SCROLL_THRESHOLD;
      setCanScrollLeft(track.scrollLeft > 0);
      setCanScrollRight(track.scrollLeft < effectiveMaxScroll);
    };

    updateScrollState();
    track.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);

    return () => {
      track.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  const scrollTrack = (direction: "left" | "right") => {
    const track = trackRef.current;
    if (!track) return;

    const amount = track.clientWidth * SCROLL_AMOUNT_PERCENTAGE;
    track.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className={`section-padding ${styles.section}`}>
      <div className="container-luratha">
        <div className={styles.header}>
          <h2 className={styles.heading}>Explore por categoria</h2>
          <div className={styles.controls}>
            <button
              type="button"
              aria-label="Categorias anteriores"
              className={styles.arrowButton}
              onClick={() => scrollTrack("left")}
              disabled={!canScrollLeft}
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Próximas categorias"
              className={styles.arrowButton}
              onClick={() => scrollTrack("right")}
              disabled={!canScrollRight}
            >
              →
            </button>
          </div>
        </div>

        <div ref={trackRef} className={styles.track} data-testid="categories-track">
          {categories.map((category) => (
            <div key={category.id} className={styles.item}>
              <CategoryBlock category={category} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
