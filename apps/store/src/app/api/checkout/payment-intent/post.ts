import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireUser } from "@luratha/auth/requireUser";
import {
  createPaymentIntent,
  loadOrder,
  PaymentProviderError,
  type PaymentIntentMethodInput,
} from "@luratha/payments";

export const runtime = "nodejs";

/**
 * POST /api/checkout/payment-intent
 *
 * Cria a order no MercadoPago (Checkout API via Orders, `POST /v1/orders`) para
 * uma Order já existente em status `pending_payment`. A Order é criada antes
 * via `POST /api/orders`; aqui usamos `Order.id` como `external_reference` para
 * correlacionar o webhook de confirmação.
 *
 * Body (discriminado por `paymentMethod`):
 *   pix         → { orderId, payer }
 *   credit_card → { orderId, payer, cardToken, installments, paymentMethodId }
 *   boleto      → { orderId, payer, payerAddress }
 *
 * Resp 201: PaymentIntentResult — PIX traz `pix.qrCode`, boleto traz `boleto.url`,
 * cartão pode já vir `status: "paid"` quando aprovado na hora.
 */

const orderIdSchema = z.string().trim().min(1).max(120);

const payerSchema = z.object({
  email: z.email("E-mail do pagador inválido."),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  identification: z
    .object({
      type: z.enum(["CPF", "CNPJ"]),
      number: z
        .string()
        .trim()
        .regex(/^\d{11}$|^\d{14}$/, "Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos."),
    })
    .refine((id) => (id.type === "CPF" ? id.number.length === 11 : id.number.length === 14), {
      message: "Número do documento não confere com o tipo (CPF=11, CNPJ=14).",
      path: ["number"],
    }),
});

const boletoAddressSchema = z.object({
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, "CEP deve ter formato 99999-999."),
  streetName: z.string().trim().min(1).max(120),
  streetNumber: z.string().trim().min(1).max(20),
  neighborhood: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  federalUnit: z.string().trim().length(2).toUpperCase(),
});

const bodySchema = z.discriminatedUnion("paymentMethod", [
  z.object({
    paymentMethod: z.literal("pix"),
    orderId: orderIdSchema,
    payer: payerSchema,
  }),
  z.object({
    paymentMethod: z.literal("credit_card"),
    orderId: orderIdSchema,
    payer: payerSchema,
    cardToken: z.string().trim().min(1).max(256),
    installments: z.number().int().min(1).max(24),
    paymentMethodId: z.string().trim().min(1).max(40),
  }),
  z.object({
    paymentMethod: z.literal("boleto"),
    orderId: orderIdSchema,
    payer: payerSchema,
    payerAddress: boletoAddressSchema,
  }),
]);

function toMethodInput(body: z.infer<typeof bodySchema>): PaymentIntentMethodInput {
  if (body.paymentMethod === "credit_card") {
    return {
      paymentMethod: "credit_card",
      payer: body.payer,
      cardToken: body.cardToken,
      installments: body.installments,
      paymentMethodId: body.paymentMethodId,
    };
  }
  if (body.paymentMethod === "boleto") {
    return { paymentMethod: "boleto", payer: body.payer, payerAddress: body.payerAddress };
  }
  return { paymentMethod: "pix", payer: body.payer };
}

export async function POST(request: Request) {
  let authedUser;
  try {
    authedUser = await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

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

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dados de pagamento inválidos.", errors: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const order = await loadOrder(body.orderId);
  if (!order) {
    return NextResponse.json(
      { message: `Pedido "${body.orderId}" não encontrado.` },
      { status: 404 },
    );
  }
  if (order.userId !== authedUser.uid) {
    return NextResponse.json(
      { message: "Este pedido não pertence ao usuário autenticado." },
      { status: 403 },
    );
  }
  if (order.paymentMethod !== body.paymentMethod) {
    return NextResponse.json(
      { message: "Método de pagamento difere do registrado no pedido." },
      { status: 400 },
    );
  }
  if (order.paymentStatus !== "pending") {
    return NextResponse.json(
      { message: "Este pedido já possui um pagamento em andamento." },
      { status: 409 },
    );
  }

  try {
    const { result } = await createPaymentIntent(order, toMethodInput(body));
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      const status =
        error.code === "config_missing" ? 500 : error.code === "invalid_input" ? 400 : 502;
      return NextResponse.json({ message: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
