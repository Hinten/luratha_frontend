"use client";

import { useState } from "react";
import styles from "./SizeSelector.module.css";
import AddToCartButton from "./AddToCartButton";

interface SizeSelectorProps {
  sizes: string[];
  productName: string;
  /** Cart data — required to enable real "Adicionar ao Carrinho" */
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

  const canAddToCart =
    productId !== undefined &&
    slug !== undefined &&
    imageUrl !== undefined &&
    price !== undefined;

  function handleSizeClick(size: string) {
    setSelectedSize(size);
    setSizeError(false);
  }

  /** Validates size selection before AddToCartButton proceeds. */
  function handleBeforeAdd(): boolean {
    if (!selectedSize) {
      setSizeError(true);
      return false;
    }
    setSizeError(false);
    return true;
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

      {canAddToCart ? (
        <AddToCartButton
          productId={productId!}
          name={productName}
          slug={slug!}
          imageUrl={imageUrl!}
          price={price!}
          size={selectedSize ?? ""}
          className={styles.addToCart}
          onBeforeAdd={handleBeforeAdd}
        />
      ) : (
        <button
          type="button"
          className={styles.addToCart}
          aria-label={`Adicionar ${productName} ao carrinho`}
          onClick={() => {
            if (!selectedSize) {
              setSizeError(true);
            } else {
              setSizeError(false);
            }
          }}
        >
          ADICIONAR AO CARRINHO
        </button>
      )}

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
