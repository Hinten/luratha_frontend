"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/src/lib/analytics/gtag";

/**
 * Dispara `page_view` a cada mudança de rota do App Router (o `config` usa
 * `send_page_view: false`, então o hit inicial e as navegações SPA são manuais).
 *
 * Usa `useSearchParams`, então deve ser renderizado dentro de um `<Suspense>`
 * (feito por `Analytics.tsx`) para não forçar a árvore inteira a client-render.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    pageview(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  return null;
}
