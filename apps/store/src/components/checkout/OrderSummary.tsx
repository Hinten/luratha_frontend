"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import type { CartItem } from "@luratha/schemas";
import styles from "./OrderSummary.module.css";

export interface AppliedCoupon {
  code: string;
  /** Sempre positivo. */
  discount: number;
  type: "percentage" | "fixed";
}

export interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  shippingTotal: number;
  /** Desconto extra (cupom). */
  discountTotal?: number;
  appliedCoupon?: AppliedCoupon | null;
  /**
   * Quando true (default), renderiza a lista de itens. Em layouts mais
   * compactos (ex.: aside fixo em mobile), passar `false`.
   */
  showItems?: boolean;
  /** Título do bloco; default "Resumo do pedido". */
  title?: string;
  /**
   * Slot opcional renderizado após os totais. Usado pelo CheckoutFlow no
   * step "review" pra colocar o botão "Confirmar pedido" próximo do total,
   * em vez de no main column.
   */
  children?: ReactNode;
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatMoney(value: number): string {
  return brl.format(value);
}

export default function OrderSummary({
  items,
  subtotal,
  shippingTotal,
  discountTotal = 0,
  appliedCoupon = null,
  showItems = true,
  title = "Resumo do pedido",
  children,
}: OrderSummaryProps) {
  const total = Math.max(0, subtotal - discountTotal + shippingTotal);

  return (
    <aside className={styles.summary} aria-label={title}>
      <h3 className={styles.heading}>{title}</h3>

      {showItems && items.length > 0 && (
        <ul className={styles.itemList}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <div className={styles.thumb}>
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={56}
                  height={56}
                  className={styles.thumbImg}
                />
                <span className={styles.qtyBadge} aria-label={`Quantidade ${item.quantity}`}>
                  {item.quantity}
                </span>
              </div>
              <div className={styles.itemInfo}>
                <p className={styles.itemName}>{item.name}</p>
                {item.variantLabel && <p className={styles.itemVariant}>{item.variantLabel}</p>}
              </div>
              <p className={styles.itemPrice}>{formatMoney(item.unitPrice * item.quantity)}</p>
            </li>
          ))}
        </ul>
      )}

      <dl className={styles.totals}>
        <div className={styles.row}>
          <dt>Subtotal</dt>
          <dd>{formatMoney(subtotal)}</dd>
        </div>

        {discountTotal > 0 && (
          <div className={styles.row} data-variant="discount">
            <dt>Desconto{appliedCoupon ? ` (${appliedCoupon.code})` : ""}</dt>
            <dd>− {formatMoney(discountTotal)}</dd>
          </div>
        )}

        <div className={styles.row}>
          <dt>Frete</dt>
          <dd>
            {shippingTotal === 0 ? (
              <span className={styles.shippingFree}>Grátis</span>
            ) : (
              formatMoney(shippingTotal)
            )}
          </dd>
        </div>

        <div className={`${styles.row} ${styles.totalRow}`}>
          <dt>Total</dt>
          <dd>{formatMoney(total)}</dd>
        </div>
      </dl>

      {children && <div className={styles.footer}>{children}</div>}
    </aside>
  );
}
