"use client";

import { useCallback, useState } from "react";
import { ZodError } from "zod";
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
  const [failed, setFailed] = useState(false);

  const handleClick = useCallback(async () => {
    if (onBeforeAdd && !onBeforeAdd()) return;
    setBusy(true);
    setFailed(false);
    try {
      await addItem(item);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 2500);
    } catch (err) {
      // The guest cart rejects with a ZodError when the payload fails the
      // cart-item schema, and a network fault surfaces as a TypeError. Surface
      // a retry hint instead of leaving an unhandled rejection that blocks the
      // page; anything else is unexpected and rethrown.
      if (err instanceof ZodError || err instanceof TypeError) {
        setFailed(true);
        return;
      }
      throw err;
    } finally {
      setBusy(false);
    }
  }, [addItem, item, onBeforeAdd]);

  return (
    <>
      <button
        type="button"
        className={className ?? styles.addToCart}
        onClick={handleClick}
        disabled={disabled || busy || isSyncing}
        aria-label={`Adicionar ${item.name} ao carrinho`}
      >
        {added ? "✓ ADICIONADO!" : "ADICIONAR AO CARRINHO"}
      </button>
      {failed && (
        <span className={styles.error} role="alert">
          Não foi possível adicionar ao carrinho. Tente novamente.
        </span>
      )}
    </>
  );
}
