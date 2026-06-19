"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pixelPageview } from "@/src/lib/analytics/fbq";

/**
 * Dispara `PageView` a cada navegação SPA do App Router. O `PageView` inicial já
 * é enviado pelo bootstrap inline de `MetaPixel.tsx`, então este tracker ignora
 * o primeiro render — sem isso, a primeira visualização contaria duas vezes.
 *
 * Usa `useSearchParams`, então deve ser renderizado dentro de um `<Suspense>`
 * (feito por `MetaPixel.tsx`) para não forçar a árvore inteira a client-render.
 */
export default function MetaPixelPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    pixelPageview();
  }, [pathname, searchParams]);

  return null;
}
