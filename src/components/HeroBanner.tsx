"use client";

import { useState, useEffect, useCallback } from "react";

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
    gradientFrom: "#EDE4D9",
    gradientTo: "#E8B9C9",
    ctaLabel: "Explorar coleção",
    ctaHref: "/colecao",
  },
  {
    id: "2",
    title: "Novas chegadas",
    subtitle: "Vestidos exclusivos que contam histórias",
    gradientFrom: "#E8B9C9",
    gradientTo: "#A8B8A2",
    ctaLabel: "Ver lançamentos",
    ctaHref: "/colecao",
  },
  {
    id: "3",
    title: "SALE até 50% OFF",
    subtitle: "Peças selecionadas com desconto especial — só por tempo limitado",
    gradientFrom: "#A8B8A2",
    gradientTo: "#EDE4D9",
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
    <section
      aria-label="Banner principal"
      className="relative w-full overflow-hidden"
      style={{ minHeight: "80vh" }}
    >
      {/* Slide */}
      <div
        className="w-full flex flex-col items-center justify-center text-center px-6 transition-all duration-500"
        style={{
          minHeight: "80vh",
          background: `linear-gradient(135deg, ${slide.gradientFrom} 0%, ${slide.gradientTo} 100%)`,
        }}
      >
        <div className="container-luratha flex flex-col items-center gap-6 py-24">
          <span className="inline-block text-xs font-medium uppercase tracking-widest text-[var(--color-neutral-dark)]/60 bg-white/40 px-4 py-1.5 rounded-full">
            Luratha — Slow Fashion
          </span>
          <h1
            className="font-[family-name:var(--font-heading)] text-[var(--color-neutral-dark)] max-w-2xl"
            style={{ letterSpacing: "-0.02em" }}
          >
            {slide.title}
          </h1>
          <p className="font-[family-name:var(--font-body)] text-[var(--color-neutral-dark)]/70 text-lg max-w-xl">
            {slide.subtitle}
          </p>
          <a
            href={slide.ctaHref}
            className="mt-4 bg-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-dark)]/80 text-[var(--color-neutral-light)] font-medium px-8 py-4 rounded-3xl transition-all duration-300 shadow-sm hover:shadow-md inline-flex items-center gap-2"
          >
            {slide.ctaLabel}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
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

      {/* Prev / Next buttons */}
      <button
        onClick={goPrev}
        aria-label="Slide anterior"
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white text-[var(--color-neutral-dark)] rounded-full p-2 shadow transition-all duration-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>
      <button
        onClick={goNext}
        aria-label="Próximo slide"
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white text-[var(--color-neutral-dark)] rounded-full p-2 shadow transition-all duration-200"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => goTo(i)}
            aria-label={`Ir para slide ${i + 1}`}
            className={`rounded-full transition-all duration-300 ${
              i === current
                ? "w-6 h-2.5 bg-[var(--color-neutral-dark)]"
                : "w-2.5 h-2.5 bg-[var(--color-neutral-dark)]/30 hover:bg-[var(--color-neutral-dark)]/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
