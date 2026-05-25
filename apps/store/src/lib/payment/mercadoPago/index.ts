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

/**
 * Adapter do MercadoPago — Checkout Transparente (`/v1/payments`).
 *
 * Cobre PIX (QR code), cartão de crédito (token gerado no browser) e boleto.
 * Erros do SDK são convertidos em `PaymentProviderError`.
 */

const BOLETO_PAYMENT_METHOD_ID = "bolbradesco";

/**
 * Serializa um payload arbitrário em JSON compacto (uma linha) para logging.
 * Cloud Logging trata cada `console.error(msg, obj)` com objeto multi-linha
 * como múltiplas entries — converter pra string única deixa o log copiável.
 *
 * `Error` não é serializado por `JSON.stringify` nativamente (name/message
 * não são enumeráveis); o replacer extrai name/message + props customizadas
 * (`status`, `cause`, …) e omite `stack` pra manter terso.
 */
function serializeLogPayload(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (val instanceof Error) {
        const out: Record<string, unknown> = {
          name: val.name,
          message: val.message,
        };
        for (const k of Object.getOwnPropertyNames(val)) {
          if (k === "name" || k === "message" || k === "stack") continue;
          out[k] = (val as unknown as Record<string, unknown>)[k];
        }
        return out;
      }
      return val;
    });
  } catch (err) {
    if (err instanceof TypeError) {
      // Ref circular ou BigInt na chain — fallback pra String() pra não
      // mascarar o erro original do request por uma falha de logging.
      return String(value);
    }
    throw err;
  }
}

/**
 * Extrai `name`/`message`/`status` de um erro do SDK MP. O pacote `mercadopago`
 * lança em dois shapes distintos:
 *   1. `Error` nativo — raro, geralmente quando o failure mode é local (rede,
 *      AbortError, etc.).
 *   2. **Objeto plain** — caminho padrão pra 4xx/5xx do gateway MP. Shape:
 *      `{ message, error, status, cause }`. **Não** é instância de `Error`,
 *      então `err instanceof Error` é falso e `String(err)` produz
 *      `"[object Object]"` (foi o bug que motivou esse helper).
 *
 * Exportado pra ter cobertura de teste sem precisar bater no SDK real.
 */
export function describeMercadoPagoError(err: unknown): {
  name: string;
  message: string;
  status: number | undefined;
} {
  if (err instanceof Error) {
    const s = (err as { status?: unknown }).status;
    return {
      name: err.name,
      message: err.message,
      status: typeof s === "number" ? s : undefined,
    };
  }
  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.message === "string") parts.push(obj.message);
    if (typeof obj.error === "string" && obj.error !== obj.message) {
      parts.push(`(${obj.error})`);
    }
    const message =
      parts.length > 0 ? parts.join(" ") : JSON.stringify(obj).slice(0, 240);
    const status = typeof obj.status === "number" ? obj.status : undefined;
    return { name: "MercadoPagoApiError", message, status };
  }
  return { name: "Unknown", message: String(err), status: undefined };
}

/**
 * Loga uma linha (`console.error` + JSON compacto) com o erro do SDK MP e
 * devolve um `PaymentProviderError` pra propagar pro handler da rota.
 *
 * Nota sobre 5xx + "communication_error": geralmente é transiente — o gateway
 * MP não conseguiu falar com algum downstream (rede PIX/banco). Retry manual
 * costuma resolver porque cada submit do checkout cria nova Order (idempotency
 * key muda). Se a frequência for alta, abrir issue com orderId/timestamp.
 */
function logAndRewrapMpError(
  operation: "create" | "get",
  context: Record<string, unknown>,
  err: unknown,
): PaymentProviderError {
  const { name, message, status } = describeMercadoPagoError(err);

  // Single-line: Cloud Logging quebra o objeto em várias entries se for
  // passado como 2º arg de console.error. Stringify pra entry única copiável.
  const payload = serializeLogPayload({
    ...context,
    name,
    message,
    status,
    cause: err,
  });
  console.error(`[mercadoPago] payment.${operation} failed ${payload}`);

  if (name === "AbortError") {
    return new PaymentProviderError(
      "Tempo limite ao contatar o MercadoPago (10s).",
      "provider_unavailable",
      err,
    );
  }
  if (typeof status === "number") {
    if (status >= 500) {
      return new PaymentProviderError(
        `MercadoPago temporariamente indisponível (HTTP ${status}). Tente novamente em instantes.`,
        "provider_unavailable",
        err,
      );
    }
    // 4xx: mensagem do MP costuma ser informativa ("Invalid user identification
    // number", etc.) — incluir truncada pra dar pista ao usuário sem leak de
    // payload gigante. Log completo (não truncado) segue íntegro no Cloud Logging.
    const truncated = message.length > 160 ? `${message.slice(0, 160)}…` : message;
    return new PaymentProviderError(
      `MercadoPago rejeitou o pagamento (HTTP ${status}): ${truncated}`,
      "provider_unavailable",
      err,
    );
  }
  const action = operation === "create" ? "criar" : "consultar";
  return new PaymentProviderError(
    `Falha ao ${action} pagamento no MercadoPago.`,
    "provider_unavailable",
    err,
  );
}

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
    throw logAndRewrapMpError(
      "create",
      { orderId: input.orderId, paymentMethod: input.paymentMethod },
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
    throw logAndRewrapMpError("get", { paymentId }, err);
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
