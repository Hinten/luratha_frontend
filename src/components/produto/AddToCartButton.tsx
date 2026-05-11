"use client";

import { useCallback, useState } from "react";
import { useCart, type CartItemInput } from "@/src/contexts/CartContext";
import styles from "./AddToCartButton.module.css";

export interface AddToCartButtonProps {
  /** Full payload required by the cart. Computed by the caller after variant
   *  selection so the button itself stays product-agnostic. */
  item: CartItemInput;
  disabled?: boolean;
  className?: string;
  /**
   * Called before adding to cart. Return `false` (e.g. when a required
   * variant is not yet selected) to prevent the addition without showing
   * the success state.
   */
  onBeforeAdd?: () => boolean;
}

export default function AddToCartButton({
  item,
  disabled,
  className,
  onBeforeAdd,
}: AddToCartButtonProps) {
  const { addItem, isSyncing } = useCart();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async () => {
    if (onBeforeAdd && !onBeforeAdd()) return;
    setBusy(true);
    try {
      await addItem(item);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2500);
    } finally {
      setBusy(false);
    }
  }, [addItem, item, onBeforeAdd]);

  return (
    <button
      type="button"
      className={className ?? styles.addToCart}
      onClick={handleClick}
      disabled={disabled || busy || isSyncing}
      aria-label={`Adicionar ${item.name} ao carrinho`}
    >
      {added ? "✓ ADICIONADO!" : "ADICIONAR AO CARRINHO"}
    </button>
  );
}
