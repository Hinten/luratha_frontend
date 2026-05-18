import { NextResponse } from "next/server";
import { z } from "zod";
import {
  quoteFreeShippingThreshold,
  quoteShipping,
} from "@/src/lib/shipping/service";
import { ShippingProviderError } from "@/src/lib/shipping/types";

export const runtime = "nodejs";

/**
 * POST /api/checkout/shipping
 *
 * Modo 1 — cotação completa (default):
 *   Body: { postalCode, items: [{ productId, quantity, unitPrice, weightKg?, dimensionsCm? }] }
 *   Resp: { quotes, freeShippingThreshold, referenceShippingCost }
 *
 * Modo 2 — estimativa de frete grátis (PDP/cart sem carrinho):
 *   Body: { postalCode, mode: "free-shipping-only" }
 *   Resp: { quotes, threshold, referenceShippingCost, divisor, enabled }
 *   `quotes` é a cotação de 1kg ("frete a partir de") para exibir na PDP.
 *
 * Endpoint é deliberadamente público (não exige login) — clientes anônimos
 * consultam frete antes de logar. Não retorna nada sensível.
 */

const dimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const itemSchema = z.object({
  productId: z.string().trim().min(1).max(120),
  quantity: z.number().int().positive().max(999),
  unitPrice: z.number().min(0),
  weightKg: z.number().positive().nullable().optional(),
  dimensionsCm: dimensionsSchema.nullable().optional(),
});

const postalCodeSchema = z.string().regex(/^\d{5}-?\d{3}$/, {
  message: "CEP deve ter formato 99999-999.",
});

const bodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("free-shipping-only"),
    postalCode: postalCodeSchema,
  }),
  z.object({
    mode: z.literal("quote").default("quote"),
    postalCode: postalCodeSchema,
    items: z.array(itemSchema).min(1).max(50),
  }),
]);

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Corpo da requisição inválido. Esperado JSON." },
        { status: 400 },
      );
    }
    throw err;
  }

  // Default `mode: "quote"` quando ausente para preservar UX comum.
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (obj.mode === undefined) obj.mode = "quote";
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Payload inválido.", errors: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    if (body.mode === "free-shipping-only") {
      const result = await quoteFreeShippingThreshold({
        destinationPostalCode: body.postalCode,
      });
      return NextResponse.json(result, { status: 200 });
    }

    const result = await quoteShipping({
      destinationPostalCode: body.postalCode,
      items: body.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        weightKg: i.weightKg ?? null,
        dimensionsCm: i.dimensionsCm ?? null,
      })),
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ShippingProviderError) {
      const status = error.code === "invalid_input" ? 400 : 502;
      return NextResponse.json(
        { message: error.message, code: error.code, providerId: error.providerId },
        { status },
      );
    }
    if (error instanceof Error) {
      return NextResponse.json(
        { message: `Falha ao calcular frete: ${error.message}` },
        { status: 500 },
      );
    }
    return NextResponse.json({ message: "Falha desconhecida ao calcular frete." }, { status: 500 });
  }
}
