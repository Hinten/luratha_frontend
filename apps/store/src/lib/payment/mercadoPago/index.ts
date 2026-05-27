import { createHmac, timingSafeEqual } from "node:crypto";
import {
  MP_API_BASE_URL,
  resolveMercadoPagoConfig,
  resolveWebhookSecret,
} from "@/src/lib/payment/mercadoPago/client";
import {
  type CreatePaymentInput,
  type PaymentIntentResult,
  type PaymentStatus,
  PaymentProviderError,
  type ProviderPaymentSummary,
} from "@/src/lib/payment/types";

/**
 * Adapter do MercadoPago — Checkout API via Orders (`POST /v1/orders`).
 *
 * Cobre PIX, cartão de crédito (token gerado pelo Card Payment Brick) e boleto.
 * Chamadas HTTP são feitas via `fetch` raw — o SDK npm `mercadopago@2.x` ainda
 * não expõe a classe `Order`, e usar `fetch` mantém o adapter sem dependência
 * extra. Erros do gateway são convertidos em `PaymentProviderError`.
 */

function totalAmountString(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Resolve se estamos em modo sandbox.
 *
 * Prioridade:
 *   1. `MERCADOPAGO_ENV` ("sandbox" | "production") — flag explícita, necessária
 *      porque as credenciais TEST do painel MP nem sempre vêm com prefixo
 *      `TEST-` (a detecção automática falha nesses casos).
 *   2. Fallback: prefixo `TEST-` do access token — retrocompatibilidade com
 *      ambientes em que o token ainda segue a convenção antiga.
 */
export function isMercadoPagoSandbox(accessToken: string): boolean {
  const explicit = process.env.MERCADOPAGO_ENV?.trim().toLowerCase();
  if (explicit === "sandbox") return true;
  if (explicit === "production") return false;
  return accessToken.startsWith("TEST-");
}

/**
 * Em sandbox, o MP rejeita pagamentos cujo `payer.email` não termina em
 * `@testuser.com` (`invalid_email_for_sandbox`) e ainda exige que o email
 * resolva pra um **test user comprador** distinto do vendedor — sem isso, o
 * pagamento volta com `invalid_users_involved` (HTTP 402). A UI sempre exibe
 * o email real do usuário; apenas o payload enviado pro MP muda.
 *
 * Resolução do email enviado:
 *   1. `MERCADOPAGO_SANDBOX_PAYER_EMAIL` setado → usa esse valor exato. É o
 *      caminho confiável: deve ser o email do test user comprador criado no
 *      painel MP (formato `test_user_<NN>@testuser.com`).
 *   2. Caso contrário, fallback: troca o domínio pra `@testuser.com`
 *      preservando o local-part. Resolve o `invalid_email_for_sandbox` mas
 *      pode bater em `invalid_users_involved` se o email gerado coincidir
 *      com o vendedor.
 *
 * Idempotente: se o email do input já bate com o destino, retorna inalterado.
 */
export function withSandboxEmail(input: CreatePaymentInput): CreatePaymentInput {
  const configured = process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL?.trim();
  const target = configured && configured.length > 0
    ? configured
    : `${input.payer.email.split("@")[0] || "test"}@testuser.com`;
  if (input.payer.email === target) return input;
  return {
    ...input,
    payer: { ...input.payer, email: target },
  };
}

/** Serializa payload em JSON compacto pra logging — uma linha por entry. */
function serializeLogPayload(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (val instanceof Error) {
        const out: Record<string, unknown> = { name: val.name, message: val.message };
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
      return String(value);
    }
    throw err;
  }
}

interface MpErrorShape {
  name: string;
  message: string;
  status: number | undefined;
}

/**
 * Extrai `name`/`message`/`status` de um erro do gateway MP.
 *
 * Na API de Orders, respostas 4xx retornam um body JSON com:
 *   `{ errors: [{ code, message, ... }] }` — lista, não erro único.
 * Concatenamos as mensagens (ex.: "missing_required_field; invalid_email").
 * Para erros 5xx ou de rede, o body pode estar vazio ou ser texto plain.
 *
 * Exportado pra ter cobertura de teste sem precisar bater no MP real.
 */
export function describeMercadoPagoError(err: unknown): MpErrorShape {
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
    const errors = obj.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const parts: string[] = [];
      for (const e of errors) {
        if (e && typeof e === "object") {
          const msg = (e as { message?: unknown }).message;
          const code = (e as { code?: unknown }).code;
          if (typeof msg === "string") {
            parts.push(typeof code === "string" ? `${code}: ${msg}` : msg);
          } else if (typeof code === "string") {
            parts.push(code);
          }
        }
      }
      if (parts.length > 0) {
        const status = typeof obj.status === "number" ? obj.status : undefined;
        return {
          name: "MercadoPagoApiError",
          message: parts.join("; "),
          status,
        };
      }
    }
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

function logAndRewrapMpError(
  operation: "create" | "get",
  context: Record<string, unknown>,
  err: unknown,
): PaymentProviderError {
  const { name, message, status } = describeMercadoPagoError(err);

  const payload = serializeLogPayload({
    ...context,
    name,
    message,
    status,
    cause: err,
  });
  console.error(`[mercadoPago] order.${operation} failed ${payload}`);

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
    const truncated = message.length > 160 ? `${message.slice(0, 160)}…` : message;
    return new PaymentProviderError(
      `MercadoPago rejeitou o pagamento (HTTP ${status}): ${truncated}`,
      "provider_unavailable",
      err,
    );
  }
  const action = operation === "create" ? "criar" : "consultar";
  return new PaymentProviderError(
    `Falha ao ${action} order no MercadoPago.`,
    "provider_unavailable",
    err,
  );
}

/**
 * Mapeia status da API de Orders pro vocabulário de `Order.paymentStatus`.
 *
 * Documentação MP:
 *  - `processed` (cartão aprovado, PIX recebido, boleto compensado) → `paid`
 *  - `action_required` (PIX/boleto pendentes de pagamento) → `pending`
 *  - `cancelled` / `failed` (recusa, falha) → `failed`
 *  - `refunded` (estorno) → `refunded`
 *  - `in_process` (análise antifraude) → `pending`
 */
export function mapMpStatus(mpStatus: string | undefined): PaymentStatus {
  switch (mpStatus) {
    case "processed":
      return "paid";
    case "refunded":
      return "refunded";
    case "cancelled":
    case "failed":
    case "rejected":
      return "failed";
    case "action_required":
    case "in_process":
    case "pending":
    case "created":
    default:
      return "pending";
  }
}

/** Headers comuns para qualquer chamada à API de Orders. */
function buildHeaders(accessToken: string, idempotencyKey?: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
  }
  return headers;
}

type PaymentMethodBody =
  | { id: "pix"; type: "bank_transfer" }
  | { id: "boleto"; type: "ticket" }
  | { id: string; type: "credit_card"; token: string; installments: number };

interface OrderRequestBody {
  type: "online";
  processing_mode: "automatic";
  external_reference: string;
  total_amount: string;
  description: string;
  payer: {
    email: string;
    first_name?: string;
    last_name?: string;
    identification: { type: "CPF" | "CNPJ"; number: string };
    address?: {
      zip_code: string;
      street_name: string;
      street_number: string;
      neighborhood: string;
      city: string;
      state: string;
    };
  };
  transactions: {
    payments: Array<{
      amount: string;
      payment_method: PaymentMethodBody;
    }>;
  };
}

function buildOrderBody(input: CreatePaymentInput): OrderRequestBody {
  const amount = totalAmountString(input.amount);

  let paymentMethod: PaymentMethodBody;
  if (input.paymentMethod === "pix") {
    paymentMethod = { id: "pix", type: "bank_transfer" };
  } else if (input.paymentMethod === "boleto") {
    paymentMethod = { id: "boleto", type: "ticket" };
  } else {
    paymentMethod = {
      id: input.paymentMethodId,
      type: "credit_card",
      token: input.cardToken,
      installments: input.installments,
    };
  }

  const body: OrderRequestBody = {
    type: "online",
    processing_mode: "automatic",
    external_reference: input.orderId,
    total_amount: amount,
    description: input.description,
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
              state: input.payerAddress.federalUnit,
            },
          }
        : {}),
    },
    transactions: {
      payments: [{ amount, payment_method: paymentMethod }],
    },
  };

  return body;
}

/**
 * Wrapper sobre `fetch` que aplica timeout + parse de body + propaga 4xx/5xx
 * como objetos plain pra serem tratados por `logAndRewrapMpError`.
 */
async function mpFetch(
  path: string,
  init: { method: "GET" | "POST"; headers: HeadersInit; body?: string; timeoutMs: number },
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${MP_API_BASE_URL}${path}`, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
      // Resposta sem JSON (raro — geralmente 5xx ou HTML de erro de proxy).
      parsed = { message: text.slice(0, 240) };
    }
  }

  if (!response.ok) {
    const errObj =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? { ...(parsed as Record<string, unknown>), status: response.status }
        : { message: text || response.statusText, status: response.status };
    throw errObj;
  }

  return parsed;
}

interface OrderPaymentResponse {
  id?: string;
  amount?: string;
  status?: string;
  status_detail?: string;
  payment_method?: {
    id?: string;
    type?: string;
    ticket_url?: string;
    qr_code?: string;
    qr_code_base64?: string;
    barcode_content?: string;
    digitable_line?: string;
  };
}

interface OrderResponse {
  id?: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  total_amount?: string;
  created_date?: string;
  last_updated_date?: string;
  transactions?: { payments?: OrderPaymentResponse[] };
}

/** Cria a order no MercadoPago e devolve o necessário para o client concluir. */
export async function createOrder(input: CreatePaymentInput): Promise<PaymentIntentResult> {
  const { accessToken, timeoutMs } = resolveMercadoPagoConfig();
  const sandbox = isMercadoPagoSandbox(accessToken);
  const effectiveInput = sandbox ? withSandboxEmail(input) : input;
  if (sandbox && effectiveInput.payer.email !== input.payer.email) {
    // Log informativo pra confirmar nos logs do servidor qual email
    // efetivamente foi enviado ao MP. Útil pra diferenciar uso de
    // MERCADOPAGO_SANDBOX_PAYER_EMAIL (test user explícito) do fallback
    // de domínio (que ainda pode bater em `invalid_users_involved`).
    console.info(
      `[mercadoPago] sandbox detected — payer.email rewritten to ${effectiveInput.payer.email}`,
    );
  }
  const body = buildOrderBody(effectiveInput);

  let response: OrderResponse;
  try {
    response = (await mpFetch("/v1/orders", {
      method: "POST",
      headers: buildHeaders(accessToken, input.orderId),
      body: JSON.stringify(body),
      timeoutMs,
    })) as OrderResponse;
  } catch (err) {
    if (err instanceof PaymentProviderError) throw err;
    throw logAndRewrapMpError(
      "create",
      { orderId: input.orderId, paymentMethod: input.paymentMethod },
      err,
    );
  }

  if (!response.id) {
    throw new PaymentProviderError(
      "MercadoPago não retornou o id da order.",
      "provider_unavailable",
    );
  }

  const firstPayment = response.transactions?.payments?.[0];
  const result: PaymentIntentResult = {
    paymentId: response.id,
    paymentMethod: input.paymentMethod,
    status: mapMpStatus(response.status),
    statusDetail: response.status_detail ?? undefined,
  };

  if (input.paymentMethod === "pix") {
    const pm = firstPayment?.payment_method;
    if (!pm?.qr_code || !pm?.qr_code_base64) {
      throw new PaymentProviderError(
        "MercadoPago não retornou o QR Code do PIX.",
        "provider_unavailable",
      );
    }
    result.pix = {
      qrCode: pm.qr_code,
      qrCodeBase64: pm.qr_code_base64,
      ticketUrl: pm.ticket_url ?? undefined,
    };
  }

  if (input.paymentMethod === "boleto") {
    const pm = firstPayment?.payment_method;
    if (!pm?.ticket_url) {
      throw new PaymentProviderError(
        "MercadoPago não retornou a URL do boleto.",
        "provider_unavailable",
      );
    }
    result.boleto = {
      url: pm.ticket_url,
      barcode: pm.barcode_content ?? undefined,
      digitableLine: pm.digitable_line ?? undefined,
    };
  }

  return result;
}

/** Consulta uma order no MercadoPago — usado pelo webhook para confirmar. */
export async function getOrder(orderId: string): Promise<ProviderPaymentSummary> {
  const { accessToken, timeoutMs } = resolveMercadoPagoConfig();

  let response: OrderResponse;
  try {
    response = (await mpFetch(`/v1/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      headers: buildHeaders(accessToken),
      timeoutMs,
    })) as OrderResponse;
  } catch (err) {
    if (err instanceof PaymentProviderError) throw err;
    throw logAndRewrapMpError("get", { orderId }, err);
  }

  const externalReference = response.external_reference;
  if (!externalReference) {
    throw new PaymentProviderError(
      `Order ${orderId} não possui external_reference.`,
      "invalid_input",
    );
  }

  const status = mapMpStatus(response.status);
  return {
    paymentId: response.id ?? orderId,
    status,
    orderId: externalReference,
    approvedAt: status === "paid" ? response.last_updated_date ?? undefined : undefined,
  };
}

/**
 * Valida a assinatura `x-signature` de um webhook do MercadoPago.
 *
 * Manifesto: `id:<dataId>;request-id:<requestId>;ts:<ts>;` — HMAC-SHA256 (hex)
 * com `MERCADOPAGO_WEBHOOK_SECRET`, comparado em tempo constante.
 *
 * Para a API de Orders, `data.id` é o id da Order (ex.: `ORD01J…`) e chega
 * em uppercase; precisa ser normalizado pra lowercase antes do HMAC.
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
