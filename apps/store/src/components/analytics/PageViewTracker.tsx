"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/src/lib/analytics/gtag";

/**
 * Dispara `page_view` a cada mudança de ROTA (path) do App Router. Mudanças só
 * de query string (filtros, `?sort=`, paginação, o `?step=` do checkout) NÃO
 * geram um novo `page_view` — evita hits duplicados quando a URL ganha um
 * query param logo após a navegação. A busca é coberta pelo evento `search`.
 *
 * O dedup vive em escopo de módulo (`lastFiredPath`) — não em `useRef` — pra
 * sobreviver a remounts da árvore (StrictMode do React em dev, unwind da
 * Suspense que envolve o tracker em `Analytics.tsx`, e o caso particular do
 * `/checkout/sucesso/{orderId}` que é alcançado por dois caminhos distintos:
 * `window.location.assign` no checkout cartão e `router.replace` no PIX/Boleto).
 * `useRef` é re-inicializado em remount; uma variável de módulo persiste
 * enquanto a aba estiver viva e só reseta em hard reload — exatamente quando
 * queremos um novo `page_view` mesmo.
 *
 * Usa `useSearchParams` (lido só para compor a URL do primeiro hit da rota),
 * então deve ficar dentro de um `<Suspense>` — feito por `Analytics.tsx`.
 */
let lastFiredPath: string | null = null;

/** @internal — uso exclusivo de testes para resetar o dedup de módulo. */
export function __resetPageViewTrackerForTests(): void {
  lastFiredPath = null;
}

export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (lastFiredPath === pathname) return;
    lastFiredPath = pathname;
    const query = searchParams.toString();
    pageview(query ? `${pathname}?${query}` : pathname);
    // Dispara só na mudança de path; `searchParams` é lido apenas para compor a
    // URL e não deve, por si só, gerar um novo page_view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
