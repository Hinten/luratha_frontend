"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/src/lib/analytics/gtag";

/**
 * Dispara `page_view` a cada mudança de ROTA (path) do App Router. Mudanças só
 * de query string (filtros, `?sort=`, paginação, o `?step=` do checkout) NÃO
 * geram um novo `page_view` — isso evitava hits duplicados quando a URL ganha
 * um query param logo após a navegação (ex.: o `/checkout` reescreve para
 * `?step=identification` no mount). A busca é coberta pelo evento `search`.
 *
 * O `lastPath` ref também absorve o duplo-disparo do React StrictMode em dev
 * (mesmo path → ignorado). Usa `useSearchParams` (lido só para compor a URL do
 * primeiro hit da rota), então deve ficar dentro de um `<Suspense>` — feito por
 * `Analytics.tsx`.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const query = searchParams.toString();
    pageview(query ? `${pathname}?${query}` : pathname);
    // Dispara só na mudança de path; `searchParams` é lido apenas para compor a
    // URL e não deve, por si só, gerar um novo page_view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
