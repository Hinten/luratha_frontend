"use client";

import type { CartAdjustment } from "@/src/app/api/cart/validate/route";
import styles from "./CartStockBanner.module.css";

function describeAdjustment(adj: CartAdjustment): string {
  if (adj.action === "cap") {
    const unit = adj.availableQty === 1 ? "unidade" : "unidades";
    return `Reduzimos “${adj.name}” para ${adj.availableQty} ${unit} — é o estoque disponível.`;
  }
  if (adj.reason === "out_of_stock") {
    return `“${adj.name}” esgotou e foi removido do carrinho.`;
  }
  return `“${adj.name}” não está mais disponível e foi removido do carrinho.`;
}

interface CartStockBannerProps {
  adjustments: CartAdjustment[];
  onDismiss: () => void;
}

/**
 * Aviso não-bloqueante exibido quando a revalidação em bulk do estoque
 * (`/api/cart/validate`) ajustou o carrinho — capou quantidades ou removeu
 * itens esgotados. Informativo (`role="status"`): não interrompe o funil.
 */
export default function CartStockBanner({ adjustments, onDismiss }: CartStockBannerProps) {
  if (adjustments.length === 0) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <div className={styles.body}>
        <p className={styles.title}>Atualizamos seu carrinho</p>
        <ul className={styles.list}>
          {adjustments.map((adj) => (
            <li key={`${adj.action}:${adj.itemId}`}>{describeAdjustment(adj)}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className={styles.dismiss}
        onClick={onDismiss}
        aria-label="Dispensar aviso"
      >
        ✕
      </button>
    </div>
  );
}
