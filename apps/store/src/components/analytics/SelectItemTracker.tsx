"use client";

import { useCallback, type MouseEvent, type ReactNode } from "react";
import type { Product } from "@luratha/schemas";
import { trackSelectItem } from "@/src/lib/analytics/ecommerce";
import styles from "./SelectItemTracker.module.css";

interface SelectItemTrackerProps {
  product: Product;
  children: ReactNode;
  /** Nome da lista de origem (deve casar com o `view_item_list`). */
  listName?: string;
  /** Posição na lista (mesmo índice usado no `view_item_list`). */
  index?: number;
}

/**
 * Envolve um card de produto (server component) e dispara `select_item` quando
 * o clique leva à PDP — ou seja, quando parte de um `<a>` dentro do card. Liga
 * a lista de origem (`listName`/`index`) ao `view_item` que virá a seguir.
 *
 * O wrapper usa `display: contents` (ver `.module.css`) para não criar uma
 * caixa extra e preservar o layout do grid; a captura de clique funciona mesmo
 * assim, porque a propagação de eventos é do DOM, não do layout.
 */
export default function SelectItemTracker({
  product,
  children,
  listName,
  index,
}: SelectItemTrackerProps) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      // Ignora cliques em controles auxiliares (ex.: botão de favoritar): só
      // conta quando o alvo está dentro de um link de navegação para a PDP.
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest("a")) return;
      trackSelectItem(product, listName, index);
    },
    [product, listName, index],
  );

  return (
    <div className={styles.wrapper} onClickCapture={handleClick}>
      {children}
    </div>
  );
}
