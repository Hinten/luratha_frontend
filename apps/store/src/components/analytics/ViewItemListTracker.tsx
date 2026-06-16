"use client";

import { useEffect } from "react";
import type { Product } from "@luratha/schemas";
import { trackViewItemList } from "@/src/lib/analytics/ecommerce";

interface ViewItemListTrackerProps {
  products: Product[];
  /** Nome da lista exibida (ex.: nome da categoria), opcional. */
  listName?: string;
}

/**
 * Dispara `view_item_list` ao montar uma grade de produtos. Renderiza `null`.
 * Recebe os produtos do server component pai (serializáveis).
 */
export default function ViewItemListTracker({ products, listName }: ViewItemListTrackerProps) {
  useEffect(() => {
    if (products.length === 0) return;
    trackViewItemList(products, listName);
    // Dispara uma vez por montagem da lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
