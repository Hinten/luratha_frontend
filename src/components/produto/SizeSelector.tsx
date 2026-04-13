"use client";

import { useState } from "react";
import styles from "./SizeSelector.module.css";
import { useCart } from "@/src/contexts/CartContext";

interface SizeSelectorProps {
  sizes: string[];
  productName: string;
  /** Optional cart data — when provided, "Adicionar ao Carrinho" uses CartContext */
  productId?: string;
  slug?: string;
  imageUrl?: string;
  price?: number;
}

export default function SizeSelector({
  sizes,
  productName,
  productId,
  slug,
  imageUrl,
  price,
}: SizeSelectorProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [added, setAdded] = useState(false);

  const { addItem } = useCart();

  function handleSizeClick(size: string) {
    setSelectedSize(size);
    setSizeError(false);
  }

  function handleAddToCart() {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    setSizeError(false);

    if (productId && slug && imageUrl !== undefined && price !== undefined) {
      addItem({
        productId,
        name: productName,
        slug,
        imageUrl,
        price,
        size: selectedSize,
      });
    } else {
      /* Fallback: log when cart props are not yet wired */
      console.log(
        `Adicionado ao carrinho: ${productName} — Tamanho: ${selectedSize}`,
      );
    }

    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  function handleFavorite() {
    setFavorited((prev) => !prev);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.sizeRow}>
        <span className={styles.sizeLabel}>Tamanho</span>
        {sizeError && (
          <span className={styles.error} role="alert">
            Selecione um tamanho
          </span>
        )}
      </div>

      <div className={styles.sizeOptions} role="group" aria-label="Selecione o tamanho">
        {sizes.map((size) => (
          <button
            key={size}
            type="button"
            className={`${styles.sizeBtn} ${selectedSize === size ? styles.sizeSelected : ""}`}
            onClick={() => handleSizeClick(size)}
            aria-pressed={selectedSize === size}
          >
            {size}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={styles.addToCart}
        onClick={handleAddToCart}
      >
        {added ? "✓ ADICIONADO!" : "ADICIONAR AO CARRINHO"}
      </button>

      <button
        type="button"
        className={`${styles.favoriteBtn} ${favorited ? styles.favorited : ""}`}
        onClick={handleFavorite}
        aria-pressed={favorited}
        aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      >
        <span className={styles.heartIcon} aria-hidden="true">
          {favorited ? "♥" : "♡"}
        </span>
        {favorited ? "Favoritado" : "Favoritar"}
      </button>
    </div>
  );
}

