"use client";

import { useMemo, useState } from "react";
import ImageWithFallback from "@/src/components/ImageWithFallback";
import styles from "./SizeSelector.module.css";
import AddToCartButton from "./AddToCartButton";
import type { CartItemInput } from "@/src/contexts/CartContext";
import type {
  Product as FirestoreProduct,
  ProductVariant,
  Stock,
} from "@/src/schemas/firestore";

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

function buildVariantLabel(
  selectedColor: string | null,
  selectedSize: string | null,
  variant: ProductVariant | null,
): string | undefined {
  const parts: string[] = [];
  if (selectedColor) parts.push(selectedColor);
  if (selectedSize) parts.push(selectedSize);
  if (parts.length > 0) return parts.join(" / ");
  if (variant) {
    const fallback = [
      variant.color?.[0] ?? null,
      variant.size?.[0] ?? null,
    ].filter((entry): entry is string => Boolean(entry));
    if (fallback.length > 0) return fallback.join(" / ");
  }
  return undefined;
}

function resolvePhotoId(
  product: FirestoreProduct,
  variant: ProductVariant | null,
): string | null {
  if (variant && variant.photoIds.length > 0) return variant.photoIds[0];
  return product.photoAssets[0]?.id ?? null;
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
      // A variant with a `null` axis is not differentiated on it (e.g. a
      // size-only product whose single colour lives on `product.color`), so it
      // matches any selected value for that axis.
      const colorMatch = !color || v.color == null || v.color.includes(color);
      const sizeMatch = !size || v.size == null || v.size.includes(size);
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
  return resolution.downloadUrl;
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

  const hasVariants = (product.variants?.length ?? 0) > 0;
  const currentQty = getCurrentQty(product, stock, selectedColor, selectedSize, hasColors, hasSizes);
  const totalStock = stock?.quantity ?? product.totalStock;

  const selectionComplete =
    (hasColors ? selectedColor !== null : true) &&
    (hasSizes ? selectedSize !== null : true);

  const matchedVariant = useMemo(
    () => findMatchingVariant(product, selectedColor, selectedSize),
    [product, selectedColor, selectedSize],
  );

  // A variant-based product can only be added once the selection resolves to a
  // real variant. Combos that don't exist (no matching variant) must stay
  // non-addable even when the stock doc is missing or has `hasVariants: false`
  // — otherwise the cart item carries no variantId and the add is rejected.
  const variantSelectionUnavailable =
    hasVariants && selectionComplete && matchedVariant === null;

  const isOutOfStock =
    variantSelectionUnavailable ||
    (hasColors || hasSizes
      ? selectionComplete && currentQty !== null && currentQty === 0
      : totalStock === 0);

  // For simple products without variants, fall back to product.totalStock
  const stockQtyForDisplay =
    currentQty ?? ((!hasColors && !hasSizes) ? totalStock : null);

  const urgency =
    stockQtyForDisplay !== null && stockQtyForDisplay > 0
      ? urgencyMessage(stockQtyForDisplay)
      : null;

  const cartItemInput: CartItemInput | null = useMemo(() => {
    if (
      productId === undefined ||
      slug === undefined ||
      imageUrl === undefined ||
      price === undefined
    ) {
      return null;
    }
    const variantInfo = matchedVariant;
    const photoId = resolvePhotoId(product, variantInfo);
    if (!photoId) return null;

    const sku = variantInfo?.sku ?? product.sku;
    return {
      productId,
      variantId: variantInfo?.id,
      variantSku: sku,
      productSlug: slug,
      name: product.title,
      photoId,
      imageUrl,
      variantLabel: buildVariantLabel(selectedColor, selectedSize, variantInfo),
      unitPrice: price,
      currency: "BRL",
      quantity: 1,
    };
  }, [
    imageUrl,
    matchedVariant,
    price,
    product,
    productId,
    selectedColor,
    selectedSize,
    slug,
  ]);

  const canAddToCart = cartItemInput !== null;

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
                    <ImageWithFallback
                      src={swatchUrl}
                      alt=""
                      aria-hidden="true"
                      width={56}
                      height={56}
                      sizes="56px"
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
      ) : canAddToCart && cartItemInput ? (
        <AddToCartButton
          item={cartItemInput}
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
