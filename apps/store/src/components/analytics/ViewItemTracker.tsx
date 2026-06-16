"use client";

import { useEffect, useRef } from "react";
import type { Product } from "@luratha/schemas";
import { trackViewItem } from "@/src/lib/analytics/ecommerce";

/**
 * Dispara `view_item` ao montar a página de detalhe do produto. Renderiza
 * `null` — só side-effect. Recebe o `Product` do server component pai
 * (serializável). O `lastId` ref evita o disparo duplo do React StrictMode
 * (dev) e só re-dispara quando o produto exibido muda de fato.
 */
export default function ViewItemTracker({ product }: { product: Product }) {
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (lastId.current === product.id) return;
    lastId.current = product.id;
    trackViewItem(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  return null;
}
