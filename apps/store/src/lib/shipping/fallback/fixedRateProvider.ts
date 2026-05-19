import {
  ShippingProviderError,
  type CalculateShippingInput,
  type ShippingProvider,
  type ShippingQuote,
} from "@/src/lib/shipping/types";
import type { FixedRateEntry, ShippingSettings } from "@/src/schemas/firestore";

/**
 * Tabela manual por UF. Resolução do UF é feita por prefixo de CEP — não é
 * preciso uma API externa só para descobrir o estado.
 *
 * Usado em dois cenários:
 *  - `siteSettings.shipping.providerId === "fixed-rate"` (loja optou)
 *  - degradação graceful quando o provider externo falha
 *    (o caller decide se quer fazer o fallback automático).
 */

const CEP_PREFIX_TO_STATE: ReadonlyArray<{ range: [number, number]; state: string }> = [
  { range: [1000, 19999], state: "SP" },
  { range: [20000, 28999], state: "RJ" },
  { range: [29000, 29999], state: "ES" },
  { range: [30000, 39999], state: "MG" },
  { range: [40000, 48999], state: "BA" },
  { range: [49000, 49999], state: "SE" },
  { range: [50000, 56999], state: "PE" },
  { range: [57000, 57999], state: "AL" },
  { range: [58000, 58999], state: "PB" },
  { range: [59000, 59999], state: "RN" },
  { range: [60000, 63999], state: "CE" },
  { range: [64000, 64999], state: "PI" },
  { range: [65000, 65999], state: "MA" },
  { range: [66000, 68899], state: "PA" },
  { range: [68900, 68999], state: "AP" },
  { range: [69000, 69299], state: "AM" },
  { range: [69300, 69399], state: "RR" },
  { range: [69400, 69899], state: "AM" },
  { range: [69900, 69999], state: "AC" },
  { range: [70000, 72799], state: "DF" },
  { range: [72800, 72999], state: "GO" },
  { range: [73000, 73699], state: "DF" },
  { range: [73700, 76799], state: "GO" },
  { range: [76800, 76999], state: "RO" },
  { range: [77000, 77999], state: "TO" },
  { range: [78000, 78899], state: "MT" },
  { range: [78900, 78999], state: "RO" },
  { range: [79000, 79999], state: "MS" },
  { range: [80000, 87999], state: "PR" },
  { range: [88000, 89999], state: "SC" },
  { range: [90000, 99999], state: "RS" },
];

function stateFromPostalCode(postalCode: string): string | null {
  const digits = postalCode.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const prefix = Number.parseInt(digits.slice(0, 5), 10);
  if (!Number.isFinite(prefix)) return null;
  const match = CEP_PREFIX_TO_STATE.find(({ range }) => prefix >= range[0] && prefix <= range[1]);
  return match?.state ?? null;
}

function priceForEntry(entry: FixedRateEntry, totalWeightKg: number): number {
  const overweight = Math.max(0, totalWeightKg - entry.weightLimitKg);
  return Math.round((entry.price + overweight * entry.additionalKgPrice) * 100) / 100;
}

export const fixedRateProvider: ShippingProvider = {
  id: "fixed-rate",

  async calculate(
    input: CalculateShippingInput,
    settings: ShippingSettings,
  ): Promise<ShippingQuote[]> {
    const config = settings.fixedRate;
    const state = stateFromPostalCode(input.destinationPostalCode);
    const entry = config.entries.find((e) => e.state === state) ?? config.defaultEntry;

    if (!entry) {
      throw new ShippingProviderError(
        `Sem tabela de frete fixo para UF "${state ?? "desconhecida"}" e sem defaultEntry.`,
        "fixed-rate",
        "config_missing",
      );
    }

    const totalWeightKg = input.items.reduce(
      (sum, item) => sum + item.weightKg * item.quantity,
      0,
    );

    return [
      {
        providerId: "fixed-rate",
        serviceCode: "default",
        carrier: config.carrier,
        service: config.service,
        price: priceForEntry(entry, totalWeightKg),
        estimatedDays: entry.estimatedDays,
      },
    ];
  },
};
