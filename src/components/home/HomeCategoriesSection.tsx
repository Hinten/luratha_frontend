"use client";

import { useEffect, useRef, useState } from "react";
import CategoryBlock from "@/src/components/categoria/CategoryBlock";
import type { Category } from "@/src/lib/types";
import styles from "./HomeCategoriesSection.module.css";

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
      setCanScrollLeft(track.scrollLeft > 0);
      setCanScrollRight(track.scrollLeft < maxScrollLeft - 1);
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

    const amount = track.clientWidth * 0.8;
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
            <div key={category.href} className={styles.item}>
              <CategoryBlock category={category} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
