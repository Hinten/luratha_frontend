"use client";

import { useState, useCallback } from "react";
import { useCart } from "@/src/contexts/CartContext";
import styles from "./AddToCartButton.module.css";

export interface AddToCartButtonProps {
  productId: string;
  name: string;
  slug: string;
  imageUrl: string;
  price: number;
  size: string;
  quantity?: number;
  disabled?: boolean;
  className?: string;
  /** Called before adding to cart. Return false to prevent the addition. */
  onBeforeAdd?: () => boolean;
}

export default function AddToCartButton({
  productId,
  name,
  slug,
  imageUrl,
  price,
  size,
  quantity = 1,
  disabled,
  className,
  onBeforeAdd,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleClick = useCallback(() => {
    if (onBeforeAdd && !onBeforeAdd()) return;

    for (let i = 0; i < quantity; i++) {
      addItem({ productId, name, slug, imageUrl, price, size });
    }

    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }, [addItem, productId, name, slug, imageUrl, price, size, quantity, onBeforeAdd]);

  return (
    <button
      type="button"
      className={className ?? styles.addToCart}
      onClick={handleClick}
      disabled={disabled}
      aria-label={`Adicionar ${name} ao carrinho`}
    >
      {added ? "✓ ADICIONADO!" : "ADICIONAR AO CARRINHO"}
    </button>
  );
}
