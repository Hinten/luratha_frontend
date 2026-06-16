"use client";

import { useEffect, useRef } from "react";
import type { Product } from "@luratha/schemas";
import { trackViewItemList } from "@/src/lib/analytics/ecommerce";

interface ViewItemListTrackerProps {
  products: Product[];
  /** Nome da lista exibida (ex.: nome da categoria), opcional. */
  listName?: string;
}

/**
 * Dispara `view_item_list` ao montar uma grade de produtos. Renderiza `null`.
 * Recebe os produtos do server component pai (serializáveis). O `fired` ref
 * garante um disparo por montagem (absorve o duplo do React StrictMode em dev).
 */
export default function ViewItemListTracker({ products, listName }: ViewItemListTrackerProps) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || products.length === 0) return;
    fired.current = true;
    trackViewItemList(products, listName);
    // Dispara uma vez por montagem da lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
