import { createHmac, timingSafeEqual } from "node:crypto";
import { Payment } from "mercadopago";
import {
  type CreatePaymentInput,
  type PaymentIntentResult,
  type PaymentStatus,
  PaymentProviderError,
  type ProviderPaymentSummary,
} from "@/src/lib/payment/types";
import {
  resolveMercadoPagoConfig,
  resolveWebhookSecret,
} from "@/src/lib/payment/mercadoPago/client";
import { serializeLogPayload } from "@luratha/core/logging/serializeLogPayload";

/**
 * Adapter do MercadoPago — Checkout Transparente (`/v1/payments`).
 *
 * Cobre PIX (QR code), cartão de crédito (token gerado no browser) e boleto.
 * Erros do SDK são convertidos em `PaymentProviderError`.
 */

const BOLETO_PAYMENT_METHOD_ID = "bolbradesco";

/** Mapeia o status do MercadoPago para o vocabulário de `Order.paymentStatus`. */
export function mapMpStatus(mpStatus: string | undefined): PaymentStatus {
  switch (mpStatus) {
    case "approved":
      return "paid";
    case "authorized":
      return "authorized";
    case "rejected":
    case "cancelled":
      return "failed";
    case "refunded":
      return "refunded";
    case "charged_back":
      // Estorno involuntário — banco devolveu o dinheiro depois de aprovação.
      // Mantido separado de `refunded` (reembolso voluntário pela loja) para
      // o backoffice conseguir distinguir reembolso planejado de chargeback.
      return "charged_back";
    case "in_mediation":
      // Disputa aberta pelo comprador APÓS o pagamento ter sido aprovado.
      // O dinheiro está retido enquanto o MercadoPago arbitra — o pedido
      // continua "pago" do ponto de vista operacional.
      return "in_dispute";
    case "pending":
    case "in_process":
    default:
      return "pending";
  }
}

function buildPaymentBody(input: CreatePaymentInput) {
  return {
    transaction_amount: input.amount,
    description: input.description,
    external_reference: input.orderId,
    ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
    payer: {
      email: input.payer.email,
      ...(input.payer.firstName ? { first_name: input.payer.firstName } : {}),
      ...(input.payer.lastName ? { last_name: input.payer.lastName } : {}),
      identification: {
        type: input.payer.identification.type,
        number: input.payer.identification.number,
      },
      ...(input.paymentMethod === "boleto"
        ? {
            address: {
              zip_code: input.payerAddress.zipCode,
              street_name: input.payerAddress.streetName,
              street_number: input.payerAddress.streetNumber,
              neighborhood: input.payerAddress.neighborhood,
              city: input.payerAddress.city,
              federal_unit: input.payerAddress.federalUnit,
            },
          }
        : {}),
    },
    ...(input.paymentMethod === "pix" ? { payment_method_id: "pix" } : {}),
    ...(input.paymentMethod === "boleto"
      ? { payment_method_id: BOLETO_PAYMENT_METHOD_ID }
      : {}),
    ...(input.paymentMethod === "credit_card"
      ? {
          payment_method_id: input.paymentMethodId,
          token: input.cardToken,
          installments: input.installments,
          capture: true,
        }
      : {}),
  };
}

/** Cria o pagamento no MercadoPago e devolve o necessário para o client concluir. */
export async function createPayment(
  input: CreatePaymentInput,
): Promise<PaymentIntentResult> {
  const payment = new Payment(resolveMercadoPagoConfig());

  let response;
  try {
    response = await payment.create({
      body: buildPaymentBody(input),
      // A idempotency key garante que um retry do mesmo pedido não gere
      // uma segunda cobrança no MercadoPago.
      requestOptions: { idempotencyKey: input.orderId },
    });
  } catch (err) {
    if (err instanceof PaymentProviderError) throw err;
    console.error(
      `[mercadoPago.createPayment] provider call failed ${serializeLogPayload({
        orderId: input.orderId,
        paymentMethod: input.paymentMethod,
        err,
      })}`,
    );
    throw new PaymentProviderError(
      "Falha ao criar pagamento no MercadoPago.",
      "provider_unavailable",
      err,
    );
  }

  if (response.id === undefined || response.id === null) {
    throw new PaymentProviderError(
      "MercadoPago não retornou o id do pagamento.",
      "provider_unavailable",
    );
  }

  const result: PaymentIntentResult = {
    paymentId: String(response.id),
    paymentMethod: input.paymentMethod,
    status: mapMpStatus(response.status),
    statusDetail: response.status_detail ?? undefined,
  };

  if (input.paymentMethod === "pix") {
    const txData = response.point_of_interaction?.transaction_data;
    if (!txData?.qr_code || !txData?.qr_code_base64) {
      throw new PaymentProviderError(
        "MercadoPago não retornou o QR Code do PIX.",
        "provider_unavailable",
      );
    }
    result.pix = {
      qrCode: txData.qr_code,
      qrCodeBase64: txData.qr_code_base64,
      ticketUrl: txData.ticket_url ?? undefined,
      expiresAt: response.date_of_expiration ?? undefined,
    };
  }

  if (input.paymentMethod === "boleto") {
    const details = response.transaction_details;
    if (!details?.external_resource_url) {
      throw new PaymentProviderError(
        "MercadoPago não retornou a URL do boleto.",
        "provider_unavailable",
      );
    }
    result.boleto = {
      url: details.external_resource_url,
      barcode: details.barcode?.content ?? undefined,
      digitableLine: details.digitable_line ?? undefined,
    };
  }

  return result;
}

/** Consulta um pagamento no MercadoPago — usado pelo webhook para confirmar. */
export async function getPayment(paymentId: string): Promise<ProviderPaymentSummary> {
  const payment = new Payment(resolveMercadoPagoConfig());

  let response;
  try {
    response = await payment.get({ id: paymentId });
  } catch (err) {
    if (err instanceof PaymentProviderError) throw err;
    console.error(
      `[mercadoPago.getPayment] provider call failed ${serializeLogPayload({
        paymentId,
        err,
      })}`,
    );
    throw new PaymentProviderError(
      "Falha ao consultar pagamento no MercadoPago.",
      "provider_unavailable",
      err,
    );
  }

  const orderId = response.external_reference;
  if (!orderId) {
    throw new PaymentProviderError(
      `Pagamento ${paymentId} não possui external_reference.`,
      "invalid_input",
    );
  }

  return {
    paymentId: String(response.id ?? paymentId),
    status: mapMpStatus(response.status),
    orderId,
    approvedAt: response.date_approved ?? undefined,
  };
}

/**
 * Valida a assinatura `x-signature` de um webhook do MercadoPago.
 *
 * Manifesto: `id:<dataId>;request-id:<requestId>;ts:<ts>;` — HMAC-SHA256 (hex)
 * com `MERCADOPAGO_WEBHOOK_SECRET`, comparado em tempo constante.
 * Ver: https://www.mercadopago.com.br/developers/en/docs/checkout-pro/payment-notifications
 */
export function verifyWebhookSignature(params: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  const { signatureHeader, requestId, dataId } = params;
  if (!signatureHeader || !dataId) return false;

  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of signatureHeader.split(",")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }
  if (!ts || !v1) return false;

  // IDs alfanuméricos devem ser comparados em minúsculas (exigência do MP).
  const normalizedId = /[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const segments = [`id:${normalizedId};`];
  if (requestId) segments.push(`request-id:${requestId};`);
  segments.push(`ts:${ts};`);
  const manifest = segments.join("");

  const expected = createHmac("sha256", resolveWebhookSecret())
    .update(manifest)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(v1, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
