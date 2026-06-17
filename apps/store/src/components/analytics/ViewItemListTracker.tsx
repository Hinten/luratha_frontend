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
 *
 * Dedup por assinatura `<listName>|<ids>` em escopo de módulo:
 * - Re-render com a MESMA lista (mesmo nome + mesmos ids) → não duplica.
 *   Cobre re-renders com `products` referencialmente novo mas conteúdo igual,
 *   StrictMode em dev, e remounts por unwind de Suspense.
 * - Mudança REAL de lista (novo nome OU ids diferentes) → re-dispara. Cobre
 *   filtros/paginação na mesma rota que substituem `products` em vez de
 *   forçar uma navegação.
 */
let lastFiredSignature: string | null = null;

/** @internal — uso exclusivo de testes para resetar o dedup de módulo. */
export function __resetViewItemListTrackerForTests(): void {
  lastFiredSignature = null;
}

export default function ViewItemListTracker({ products, listName }: ViewItemListTrackerProps) {
  useEffect(() => {
    if (products.length === 0) return;
    const signature = `${listName ?? ""}|${products.map((p) => p.id).join(",")}`;
    if (lastFiredSignature === signature) return;
    lastFiredSignature = signature;
    trackViewItemList(products, listName);
  }, [products, listName]);
  return null;
}
