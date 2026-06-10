"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./HeroBanner.module.css";

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  gradientFrom: string;
  gradientTo: string;
  ctaLabel: string;
  ctaHref: string;
}

const slides: Slide[] = [
  {
    id: "1",
    title: "Peças feitas com amor para durar",
    subtitle: "Coleção Primavera 2026 — artesanal, versátil, sustentável",
    gradientFrom: "var(--color-accent)",
    gradientTo: "var(--color-primary)",
    ctaLabel: "Explorar coleção",
    ctaHref: "/todas-as-pecas",
  },
  {
    id: "2",
    title: "Novas chegadas",
    subtitle: "Vestidos exclusivos que contam histórias",
    gradientFrom: "var(--color-primary)",
    gradientTo: "var(--color-secondary)",
    ctaLabel: "Ver lançamentos",
    ctaHref: "/todas-as-pecas",
  },
  {
    id: "3",
    title: "SALE até 50% OFF",
    subtitle: "Peças selecionadas com desconto especial — só por tempo limitado",
    gradientFrom: "var(--color-secondary)",
    gradientTo: "var(--color-accent)",
    ctaLabel: "Ver ofertas",
    ctaHref: "/sale",
  },
];

export default function HeroBanner() {
  const [current, setCurrent] = useState(0);

  const goTo = useCallback((index: number) => {
    setCurrent(index);
  }, []);

  const goNext = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, []);

  const goPrev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(goNext, 5000);
    return () => clearInterval(timer);
  }, [goNext]);

  const slide = slides[current];

  return (
    <section aria-label="Banner principal" className={styles.section}>
      {/* Slide — gradient background is dynamic so it stays as inline style */}
      <div
        className={styles.slide}
        style={{
          background: `linear-gradient(135deg, ${slide.gradientFrom} 0%, ${slide.gradientTo} 100%)`,
        }}
      >
        <div className={styles.inner}>
          <span className={styles.badge}>Luratha — Slow Fashion</span>
          <h1 className={styles.title}>{slide.title}</h1>
          <p className={styles.subtitle}>{slide.subtitle}</p>
          <a href={slide.ctaHref} className={styles.cta}>
            {slide.ctaLabel}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              width={16}
              height={16}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Prev button */}
      <button
        onClick={goPrev}
        aria-label="Slide anterior"
        className={`${styles.navBtn} ${styles.navBtnPrev}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          width={20}
          height={20}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>

      {/* Next button */}
      <button
        onClick={goNext}
        aria-label="Próximo slide"
        className={`${styles.navBtn} ${styles.navBtnNext}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          width={20}
          height={20}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Navigation dots */}
      <div className={styles.dots}>
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            aria-label={`Ir para slide ${i + 1}`}
            className={i === current ? styles.dotActive : styles.dotInactive}
          />
        ))}
      </div>
    </section>
  );
}
