import type { ShippingSettings } from "@luratha/schemas";
import type { ShippingItemInput } from "@/src/lib/shipping/types";

export interface RawShippingItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  weightKg?: number | null;
  dimensionsCm?: { length: number; width: number; height: number } | null;
}

/**
 * Aplica os fallbacks de peso/dimensões definidos em `siteSettings` antes de
 * mandar para o provider. Mantém o input do caller "burro" — quem chama não
 * precisa saber dos defaults.
 */
export function normalizeShippingItems(
  items: RawShippingItem[],
  settings: ShippingSettings,
): ShippingItemInput[] {
  const fallbackDims = settings.fallbackProductDimensionsCm;
  const fallbackWeight = settings.fallbackProductWeightKg;

  return items.map((item) => {
    const weightKg = item.weightKg && item.weightKg > 0 ? item.weightKg : fallbackWeight;
    const dims = item.dimensionsCm ?? fallbackDims;
    return {
      productId: item.productId,
      quantity: item.quantity,
      weightKg,
      lengthCm: dims.length,
      widthCm: dims.width,
      heightCm: dims.height,
      unitPrice: item.unitPrice,
    };
  });
}

/**
 * Constrói um "item virtual" de 1kg para a consulta de frete grátis,
 * usando as dimensões de fallback.
 */
export function buildOneKgReferenceItem(
  settings: ShippingSettings,
  unitPrice = 1,
): ShippingItemInput {
  return {
    productId: "__free_shipping_reference",
    quantity: 1,
    weightKg: 1,
    lengthCm: settings.fallbackProductDimensionsCm.length,
    widthCm: settings.fallbackProductDimensionsCm.width,
    heightCm: settings.fallbackProductDimensionsCm.height,
    unitPrice,
  };
}
