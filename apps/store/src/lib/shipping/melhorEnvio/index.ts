import { melhorEnvioFetch } from "@/src/lib/shipping/melhorEnvio/client";
import {
  ShippingProviderError,
  type CalculateShippingInput,
  type ShippingProvider,
  type ShippingQuote,
  type TrackingInfo,
} from "@/src/lib/shipping/types";
import type { ShippingSettings } from "@luratha/schemas";

/**
 * Adapter Melhor Envio.
 *
 * `calculate()` POSTa em /api/v2/me/shipment/calculate, mapeia a resposta
 * (array de serviços), descarta erros por serviço e devolve apenas o que está
 * habilitado em `settings.enabledServices`.
 *
 * `track()` é stub nesta PR — issue #80 ativa polling em uma PR seguinte.
 */

interface MelhorEnvioCalcRequest {
  from: { postal_code: string };
  to: { postal_code: string };
  products: Array<{
    id: string;
    width: number;
    height: number;
    length: number;
    weight: number;
    insurance_value: number;
    quantity: number;
  }>;
  options?: {
    receipt?: boolean;
    own_hand?: boolean;
    insurance_value?: number;
  };
}

interface MelhorEnvioCalcResponse {
  id: number;
  name: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  custom_delivery_time?: number;
  company?: { id: number; name: string; picture?: string };
  error?: string;
}

function toCepDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function parseDecimal(value: string | number | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  return Number.parseFloat(value.replace(",", "."));
}

export const melhorEnvioProvider: ShippingProvider = {
  id: "melhor-envio",

  async calculate(
    input: CalculateShippingInput,
    settings: ShippingSettings,
  ): Promise<ShippingQuote[]> {
    if (input.items.length === 0) {
      throw new ShippingProviderError(
        "Items vazios — nada a cotar.",
        "melhor-envio",
        "invalid_input",
      );
    }

    const totalDeclaredValue = input.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    const body: MelhorEnvioCalcRequest = {
      from: { postal_code: toCepDigits(input.originPostalCode) },
      to: { postal_code: toCepDigits(input.destinationPostalCode) },
      products: input.items.map((item, idx) => ({
        id: item.productId || `item-${idx}`,
        width: item.widthCm,
        height: item.heightCm,
        length: item.lengthCm,
        weight: item.weightKg,
        insurance_value: item.unitPrice,
        quantity: item.quantity,
      })),
      options: {
        receipt: false,
        own_hand: false,
        insurance_value: totalDeclaredValue,
      },
    };

    const response = await melhorEnvioFetch<MelhorEnvioCalcResponse[]>(
      "/api/v2/me/shipment/calculate",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );

    const enabledServices = new Map(
      settings.enabledServices
        .filter((s) => s.enabled)
        .map((s) => [s.code, s.label] as const),
    );

    const quotes: ShippingQuote[] = [];
    for (const entry of response) {
      if (entry.error) continue;
      const code = String(entry.id);
      if (enabledServices.size > 0 && !enabledServices.has(code)) continue;

      const price = parseDecimal(entry.custom_price ?? entry.price);
      const estimatedDays = entry.custom_delivery_time ?? entry.delivery_time ?? 0;
      if (!Number.isFinite(price) || price < 0) continue;

      quotes.push({
        providerId: "melhor-envio",
        serviceCode: code,
        carrier: entry.company?.name ?? "Melhor Envio",
        service: enabledServices.get(code) ?? entry.name,
        price: Math.round(price * 100) / 100,
        estimatedDays,
      });
    }

    return quotes.sort((a, b) => a.price - b.price);
  },

  async track(_trackingCode: string, _settings: ShippingSettings): Promise<TrackingInfo> {
    throw new ShippingProviderError(
      "Rastreamento ativo do Melhor Envio será implementado na issue #80 PR 2.",
      "melhor-envio",
      "not_supported",
    );
  },
};
