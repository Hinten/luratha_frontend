"use client";

import { useEffect } from "react";
import type { Product } from "@luratha/schemas";
import { trackViewItem } from "@/src/lib/analytics/ecommerce";
import { trackPixelViewContent } from "@/src/lib/analytics/pixel-ecommerce";

/**
 * Dispara `view_item` ao montar a página de detalhe do produto. Renderiza
 * `null` — só side-effect. Recebe o `Product` do server component pai
 * (serializável).
 */
export default function ViewItemTracker({ product }: { product: Product }) {
  useEffect(() => {
    trackViewItem(product);
    trackPixelViewContent(product);
    // Só re-dispara se o produto exibido mudar de fato.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);
  return null;
}
