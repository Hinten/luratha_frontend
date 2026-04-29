"use client";

import { useState } from "react";
import styles from "./SizeSelector.module.css";
import AddToCartButton from "./AddToCartButton";
import type { Product as FirestoreProduct, Stock } from "@/src/schemas/firestore";

interface SizeSelectorProps {
  product: FirestoreProduct;
  stock?: Stock | null;
  productId?: string;
  slug?: string;
  imageUrl?: string;
  price?: number;
  onColorChange?: (color: string | null) => void;
  onSizeChange?: (size: string | null) => void;
}

function extractUniqueColors(product: FirestoreProduct): string[] {
  const productColors = product.color ?? [];
  const variantColors = product.variants?.flatMap((v) => v.color ?? []) ?? [];
  return Array.from(new Set([...productColors, ...variantColors]));
}

function extractUniqueSizes(product: FirestoreProduct): string[] {
  const productSizes = product.size ?? [];
  const variantSizes = product.variants?.flatMap((v) => v.size ?? []) ?? [];
  return Array.from(new Set([...productSizes, ...variantSizes]));
}

function findMatchingVariant(
  product: FirestoreProduct,
  color: string | null,
  size: string | null,
) {
  if (!product.variants) return null;
  return (
    product.variants.find((v) => {
      const colorMatch = color ? (v.color?.includes(color) ?? false) : true;
      const sizeMatch = size ? (v.size?.includes(size) ?? false) : true;
      return colorMatch && sizeMatch;
    }) ?? null
  );
}

function getVariantQty(stock: Stock, variantId: string): number {
  return stock.variants?.[variantId] ?? 0;
}

function getColorSwatchUrl(product: FirestoreProduct, color: string): string | null {
  const variantWithPhoto = product.variants?.find(
    (variant) => (variant.color?.includes(color) ?? false) && variant.photoIds.length > 0,
  );
  if (!variantWithPhoto) return null;

  const photoId = variantWithPhoto.photoIds[0];
  const asset = product.photoAssets.find((candidate) => candidate.id === photoId);
  if (!asset) return null;

  const resolution =
    asset.resolutions.swatch ?? asset.resolutions.card ?? asset.resolutions.mobile;
  return resolution.temporaryUrl ?? resolution.downloadUrl;
}

function isColorAvailable(
  product: FirestoreProduct,
  stock: Stock | null | undefined,
  color: string,
): boolean {
  if (!stock?.hasVariants || !stock.variants) return true;
  const matching = product.variants?.filter((v) => v.color?.includes(color)) ?? [];
  if (matching.length === 0) return true;
  return matching.some((v) => getVariantQty(stock, v.id) > 0);
}

function isSizeAvailable(
  product: FirestoreProduct,
  stock: Stock | null | undefined,
  size: string,
  selectedColor: string | null,
): boolean {
  if (!stock?.hasVariants || !stock.variants) return true;
  const matching =
    product.variants?.filter((v) => {
      if (selectedColor && !(v.color?.includes(selectedColor) ?? false)) return false;
      return v.size?.includes(size) ?? false;
    }) ?? [];
  if (matching.length === 0) return selectedColor === null;
  return matching.some((v) => getVariantQty(stock, v.id) > 0);
}

function getCurrentQty(
  product: FirestoreProduct,
  stock: Stock | null | undefined,
  selectedColor: string | null,
  selectedSize: string | null,
  hasColors: boolean,
  hasSizes: boolean,
): number | null {
  if (!stock) return null;
  if (!stock.hasVariants) return stock.quantity;
  if ((hasColors && !selectedColor) || (hasSizes && !selectedSize)) return null;
  if (!product.variants) return stock.quantity;
  const variant = findMatchingVariant(product, selectedColor, selectedSize);
  if (!variant) return 0;
  return getVariantQty(stock, variant.id);
}

function urgencyMessage(qty: number): { text: string; level: "low" | "medium" | "high" } {
  if (qty === 1) return { text: "Última peça!", level: "high" };
  if (qty === 2) return { text: "Últimas 2 peças!", level: "high" };
  if (qty <= 5) return { text: `Últimas ${qty} peças!`, level: "medium" };
  return { text: "Em estoque", level: "low" };
}

const stockMsgClass = {
  low: styles.stockMsgLow,
  medium: styles.stockMsgMedium,
  high: styles.stockMsgHigh,
} as const;

export default function SizeSelector({
  product,
  stock,
  productId,
  slug,
  imageUrl,
  price,
  onColorChange,
  onSizeChange,
}: SizeSelectorProps) {
  const colors = extractUniqueColors(product);
  const sizes = extractUniqueSizes(product);
  const hasColors = colors.length > 0;
  const hasSizes = sizes.length > 0;

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [colorError, setColorError] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const [favorited, setFavorited] = useState(false);

  const currentQty = getCurrentQty(product, stock, selectedColor, selectedSize, hasColors, hasSizes);
  const totalStock = stock?.quantity ?? product.totalStock;

  const selectionComplete =
    (hasColors ? selectedColor !== null : true) &&
    (hasSizes ? selectedSize !== null : true);

  const isOutOfStock =
    hasColors || hasSizes
      ? selectionComplete && currentQty !== null && currentQty === 0
      : totalStock === 0;

  // For simple products without variants, fall back to product.totalStock
  const stockQtyForDisplay =
    currentQty ?? ((!hasColors && !hasSizes) ? totalStock : null);

  const urgency =
    stockQtyForDisplay !== null && stockQtyForDisplay > 0
      ? urgencyMessage(stockQtyForDisplay)
      : null;

  const canAddToCart =
    productId !== undefined &&
    slug !== undefined &&
    imageUrl !== undefined &&
    price !== undefined;

  function handleColorClick(color: string) {
    setSelectedColor(color);
    setColorError(false);
    setSelectedSize(null);
    setSizeError(false);
    onColorChange?.(color);
    onSizeChange?.(null);
  }

  function handleSizeClick(size: string) {
    setSelectedSize(size);
    setSizeError(false);
    onSizeChange?.(size);
  }

  function handleBeforeAdd(): boolean {
    let valid = true;
    if (hasColors && !selectedColor) { setColorError(true); valid = false; }
    if (hasSizes && !selectedSize) { setSizeError(true); valid = false; }
    return valid;
  }

  return (
    <div className={styles.wrapper}>
      {/* Color selector */}
      {hasColors && (
        <div className={styles.selectorGroup}>
          <div className={styles.selectorRow}>
            <span className={styles.selectorLabel}>Cor</span>
            {colorError && (
              <span className={styles.error} role="alert">
                Selecione uma cor
              </span>
            )}
          </div>
          <div className={styles.variantOptions} role="group" aria-label="Selecione a cor">
            {colors.map((color) => {
              const available = isColorAvailable(product, stock, color);
              const swatchUrl = getColorSwatchUrl(product, color);

              if (swatchUrl) {
                return (
                  <button
                    key={color}
                    type="button"
                    className={`${styles.colorSwatchBtn} ${!available ? styles.colorSwatchUnavailable : ""} ${selectedColor === color ? styles.colorSwatchSelected : ""}`}
                    onClick={() => handleColorClick(color)}
                    aria-pressed={selectedColor === color}
                    aria-label={color}
                  >
                    <img
                      src={swatchUrl}
                      alt=""
                      aria-hidden="true"
                      className={styles.colorSwatchImg}
                    />
                    <span className={styles.colorSwatchLabel}>{color}</span>
                  </button>
                );
              }

              return (
                <button
                  key={color}
                  type="button"
                  className={`${styles.variantBtn} ${!available ? styles.variantUnavailable : ""} ${selectedColor === color ? styles.variantSelected : ""}`}
                  onClick={() => handleColorClick(color)}
                  aria-pressed={selectedColor === color}
                >
                  {color}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size selector */}
      {hasSizes && (
        <div className={styles.selectorGroup}>
          <div className={styles.selectorRow}>
            <span className={styles.selectorLabel}>Tamanho</span>
            {sizeError && (
              <span className={styles.error} role="alert">
                Selecione um tamanho
              </span>
            )}
          </div>
          <div className={styles.sizeOptions} role="group" aria-label="Selecione o tamanho">
            {sizes.map((size) => {
              const available = isSizeAvailable(product, stock, size, selectedColor);
              return (
                <button
                  key={size}
                  type="button"
                  className={`${styles.variantBtn} ${!available ? styles.variantUnavailable : ""} ${selectedSize === size ? styles.variantSelected : ""}`}
                  onClick={() => handleSizeClick(size)}
                  aria-pressed={selectedSize === size}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock urgency message */}
      {urgency && (
        <p className={stockMsgClass[urgency.level]} aria-live="polite">
          {urgency.text}
        </p>
      )}

      {/* Add to cart / Out of stock */}
      {isOutOfStock ? (
        <button
          type="button"
          className={`${styles.addToCart} ${styles.outOfStockBtn}`}
          disabled
          aria-disabled="true"
        >
          PRODUTO ESGOTADO
        </button>
      ) : canAddToCart ? (
        <AddToCartButton
          productId={productId}
          name={product.title}
          slug={slug}
          imageUrl={imageUrl}
          price={price}
          size={selectedSize ?? ""}
          className={styles.addToCart}
          onBeforeAdd={handleBeforeAdd}
        />
      ) : (
        <button
          type="button"
          className={styles.addToCart}
          aria-label={`Adicionar ${product.title} ao carrinho`}
          onClick={handleBeforeAdd}
        >
          ADICIONAR AO CARRINHO
        </button>
      )}

      {/* Favorite */}
      <button
        type="button"
        className={`${styles.favoriteBtn} ${favorited ? styles.favorited : ""}`}
        onClick={() => setFavorited((prev) => !prev)}
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
