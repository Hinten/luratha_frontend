"use client";

import { useEffect } from "react";
import type { Product } from "@luratha/schemas";
import { trackViewItem } from "@/src/lib/analytics/ecommerce";
import { trackPixelViewContent } from "@/src/lib/analytics/pixel-ecommerce";

/**
 * Dispara `view_item` ao montar a página de detalhe do produto. Renderiza
 * `null` — só side-effect. Recebe o `Product` do server component pai
 * (serializável). O dedup por `lastFiredProductId` em escopo de módulo
 * sobrevive a remounts (StrictMode dev, Suspense unwind) e só re-dispara
 * quando o produto exibido muda de fato.
 */
let lastFiredProductId: string | null = null;

/** @internal — uso exclusivo de testes para resetar o dedup de módulo. */
export function __resetViewItemTrackerForTests(): void {
  lastFiredProductId = null;
}

export default function ViewItemTracker({ product }: { product: Product }) {
  useEffect(() => {
    if (lastFiredProductId === product.id) return;
    lastFiredProductId = product.id;
    trackViewItem(product);
    trackPixelViewContent(product);
  }, [product]);
  return null;
}
