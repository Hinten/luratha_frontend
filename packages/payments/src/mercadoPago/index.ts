import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "@luratha/core/logging/logger";
import { PAYMENT_FAILURE_STATUSES } from "@luratha/schemas";
import {
  MP_API_BASE_URL,
  resolveMercadoPagoConfig,
  resolveWebhookSecret,
} from "./client";
import {
  type BoletoArtifact,
  type CreatePaymentInput,
  type OrderArtifacts,
  type PaymentIntentResult,
  type PaymentStatus,
  PaymentProviderError,
  type PixArtifact,
  type ProviderPaymentSummary,
} from "../types";

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

/** Lookup dos status de falha (pagamento não concluído) — fonte em `@luratha/schemas`. */
const FAILURE_STATUSES = new Set<PaymentStatus>(PAYMENT_FAILURE_STATUSES);

/**
 * Resolve se estamos em modo sandbox.
 *
 * Exige `MERCADOPAGO_ENV` explícito ("sandbox" | "production") — as
 * credenciais TEST do painel MP nem sempre vêm com prefixo `TEST-`, então
 * inferir do token é ambíguo. Quando a env não está setada (ou está fora
 * desse vocabulário), joga `PaymentProviderError("config_missing")` para
 * forçar o operador a decidir explicitamente em vez de seguir um default
 * silencioso. O parâmetro `accessToken` fica reservado para um futuro
 * fallback baseado no formato do token; hoje é ignorado de propósito.
 */
export function isMercadoPagoSandbox(accessToken: string): boolean {
  const explicit = process.env.MERCADOPAGO_ENV?.trim().toLowerCase();
  if (explicit === "sandbox") return true;
  if (explicit === "production") return false;
  throw new PaymentProviderError(
    "MERCADOPAGO_ENV não configurado. Defina como 'sandbox' ou 'production' para garantir o comportamento correto.",
    "config_missing",
  );
}

/**
 * Normaliza o `payer` para o ambiente de **sandbox** do MercadoPago. Duas coisas:
 *
 * 1. **Email** — o MP rejeita pagamentos cujo `payer.email` não termina em
 *    `@testuser.com` (`invalid_email_for_sandbox`) e ainda exige que o email
 *    resolva pra um **test user comprador** distinto do vendedor (senão volta
 *    `invalid_users_involved`, HTTP 402). Resolução:
 *      a. `MERCADOPAGO_SANDBOX_PAYER_EMAIL` setado → usa esse valor exato
 *         (deve ser o test user comprador do painel, `test_user_<NN>@testuser.com`).
 *      b. Caso contrário, fallback: troca o domínio pra `@testuser.com`.
 *
 * 2. **first_name** — no sandbox o MP usa o `payer.first_name` como gatilho do
 *    **status simulado** da order (doc Checkout API Orders / test / pix): `"APRO"`
 *    devolve `action_required` com o QR/boleto na hora (e aprova em seguida); o
 *    nome real do cliente cai em análise antifraude (`in_process`, sem artefato).
 *    Lido de `MERCADOPAGO_SANDBOX_PAYER_FIRST_NAME` (default `"APRO"`) — dá pra
 *    setar outro keyword (ex.: forçar `in_process`) sem mexer no código.
 *
 * A UI sempre exibe os dados reais do usuário; só o payload enviado ao MP muda.
 * Idempotente: se email e first_name já batem com o alvo, retorna inalterado.
 */
export function withSandboxPayer(input: CreatePaymentInput): CreatePaymentInput {
  const configuredEmail = process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL?.trim();
  const email = configuredEmail && configuredEmail.length > 0
    ? configuredEmail
    : `${input.payer.email.split("@")[0] || "test"}@testuser.com`;

  const configuredName = process.env.MERCADOPAGO_SANDBOX_PAYER_FIRST_NAME?.trim();
  const firstName = configuredName && configuredName.length > 0 ? configuredName : "APRO";

  if (input.payer.email === email && input.payer.firstName === firstName) return input;
  return {
    ...input,
    payer: { ...input.payer, email, firstName },
  };
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

  logger.error(`[mercadoPago] order.${operation} failed`, {
    ...context,
    name,
    message,
    status,
    cause: err,
  });

  if (name === "AbortError") {
    // Aborto por timeout — pode ser da fase de headers ou de body read
    // (mpFetch re-arma o mesmo signal entre as duas fases), por isso a
    // mensagem não fixa um valor de segundos.
    return new PaymentProviderError(
      "Tempo limite ao contatar o MercadoPago.",
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
 * Mapeia o status da Orders API do MP pro `Order.paymentStatus`, combinando o
 * `status` (grosso), o `status_detail` (substatus) e o método
 * (`bank_transfer`=pix, `ticket`=boleto). O mesmo `status` muda de sentido
 * conforme o detail — ex.: `charged_back/in_process` (disputa em curso) vs
 * `charged_back/settled|reimbursed` (disputa encerrada/estornada).
 *
 * Tabela (MP → nosso):
 *  - `processed/accredited` → `paid`; `processed/partially_refunded` → `partially_refunded`
 *  - `processing/in_process` (antifraude / assíncrono) → `pending`
 *  - `action_required/waiting_capture` → `authorized`
 *  - `action_required/waiting_payment|waiting_transfer` → `awaiting_pix`/`awaiting_boleto`
 *  - `charged_back/in_process` → `in_dispute`; demais `charged_back` → `charged_back`
 *  - `cancelled` → `cancelled`; `rejected` → `rejected`; `failed` → `failed`; `refunded` → `refunded`
 *
 * **Fail-safe:** qualquer combinação não reconhecida → `logger.warn` + `"unknown"`.
 * Não chutamos nem silenciamos um status novo/não-documentado do MP — o pedido
 * fica travado pra revisão em vez de ser despachado sob status incerto.
 */
export function mapMpStatus(
  mpStatus: string | undefined,
  statusDetail?: string,
  methodType?: string,
): PaymentStatus {
  switch (mpStatus) {
    case "processed":
      return statusDetail === "partially_refunded" ? "partially_refunded" : "paid";
    case "processing":
    case "in_process":
    case "pending":
    case "created":
      return "pending";
    case "action_required":
      if (statusDetail === "waiting_capture") return "authorized";
      if (methodType === "bank_transfer") return "awaiting_pix";
      if (methodType === "ticket") return "awaiting_boleto";
      return "pending";
    case "charged_back":
      return statusDetail === "in_process" ? "in_dispute" : "charged_back";
    case "cancelled":
      return "cancelled";
    case "rejected":
      return "rejected";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      logger.warn("[mercadoPago] status desconhecido — revisar mapeamento", {
        status: mpStatus,
        statusDetail,
        methodType,
      });
      return "unknown";
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
 *
 * Timeout por fase, sobre um único `AbortController`:
 *  - `timeoutMs` cobre a chegada de headers (circuit-breaker rápido);
 *  - depois o timer é re-armado com `bodyTimeoutMs` para a leitura do body.
 *    Abortar o signal após o `fetch()` resolver cancela `response.text()` —
 *    o body stream está atado ao signal — fechando o gap em que um body
 *    stalled bypassava o budget. Mantemos budgets separados porque o boleto
 *    sandbox stalla no body bem além dos 10s de headers (ver issue #162).
 *
 * Ambas as fases abortam via `ctrl.abort()`, que produz um `AbortError`
 * (tratado por `logAndRewrapMpError`) — não o `TimeoutError` de
 * `AbortSignal.timeout`.
 */
async function mpFetch(
  path: string,
  init: {
    method: "GET" | "POST";
    headers: HeadersInit;
    body?: string;
    timeoutMs: number;
    bodyTimeoutMs: number;
  },
): Promise<unknown> {
  const ctrl = new AbortController();
  let timer = setTimeout(() => ctrl.abort(), init.timeoutMs);
  const startedAt = performance.now();

  let parsed: unknown = null;
  try {
    const response = await fetch(`${MP_API_BASE_URL}${path}`, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: ctrl.signal,
    });
    const headerMs = Math.round(performance.now() - startedAt);

    // Re-arma o mesmo signal para a fase de body read.
    clearTimeout(timer);
    timer = setTimeout(() => ctrl.abort(), init.bodyTimeoutMs);

    const bodyStartedAt = performance.now();
    const text = await response.text();
    logger.info("[mercadoPago] mpFetch timing", {
      path,
      headerMs,
      bodyMs: Math.round(performance.now() - bodyStartedAt),
    });

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
  } finally {
    clearTimeout(timer);
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

/**
 * Tipo do método no MP (`bank_transfer`=pix, `ticket`=boleto, `credit_card`) — usado por `mapMpStatus`.
 *
 * PRESSUPOSTO: lê só `payments[0]`. A Orders API permite **múltiplos payments por
 * order** (doc: "Multiple transactions per request"); hoje `buildOrderBody` sempre
 * cria 1 payment, então é seguro. Se um dia oferecermos pagamento combinado (dois
 * cartões, cartão + carteira), todos os extratores `payments[0]` viram bug
 * estrutural — ver follow-up em `checkout-pendencias`.
 */
function paymentMethodTypeOf(response: OrderResponse): string | undefined {
  return response.transactions?.payments?.[0]?.payment_method?.type;
}

/** `mapMpStatus` com os 3 campos (status + detail + método) extraídos da order. */
function mapOrderStatus(response: OrderResponse): PaymentStatus {
  return mapMpStatus(response.status, response.status_detail, paymentMethodTypeOf(response));
}

/**
 * Extrai o QR Code do PIX de uma order. Retorna `null` quando o MP ainda não
 * gerou o artefato (geração assíncrona) — o chamador trata como "pendente".
 */
function extractPixPayment(response: OrderResponse): PixArtifact | null {
  const pm = response.transactions?.payments?.[0]?.payment_method;
  if (!pm?.qr_code || !pm?.qr_code_base64) return null;
  return {
    qrCode: pm.qr_code,
    qrCodeBase64: pm.qr_code_base64,
    ticketUrl: pm.ticket_url ?? undefined,
  };
}

/**
 * Extrai os dados do boleto de uma order. Retorna `null` quando o MP ainda não
 * gerou o `ticket_url`.
 */
function extractBoletoPayment(response: OrderResponse): BoletoArtifact | null {
  const pm = response.transactions?.payments?.[0]?.payment_method;
  if (!pm?.ticket_url) return null;
  return {
    url: pm.ticket_url,
    barcode: pm.barcode_content ?? undefined,
    digitableLine: pm.digitable_line ?? undefined,
  };
}

/**
 * Quando uma order vem 2xx mas SEM o artefato (QR/boleto), distingue dois casos:
 *
 *  - **falha real** — o pagamento já veio recusado/cancelado/rejeitado
 *    (`mapMpStatus` ∈ `PAYMENT_FAILURE_STATUSES`). Não adianta pollar; lança
 *    `PaymentProviderError` com o detalhe do MP.
 *  - **ausência assíncrona** — status ainda pendente; o artefato deve aparecer ao
 *    reler a order. Retorna `"pending"` e o chamador marca `*Pending`.
 *
 * Em AMBOS os casos loga o **body cru** (a `OrderResponse` inteira) — o HTTP é
 * 2xx, então o erro não passa por `logAndRewrapMpError`; sem este log não há como
 * diagnosticar o que o MP devolveu.
 */
function classifyMissingArtifact(
  operation: "create" | "get",
  context: { orderId: string; paymentMethod: string },
  response: OrderResponse,
): "pending" {
  const status = mapOrderStatus(response);
  logger.warn("[mercadoPago] order sem artefato de pagamento", {
    operation,
    ...context,
    status: response.status,
    statusDetail: response.status_detail,
    rawResponse: response,
  });

  if (FAILURE_STATUSES.has(status)) {
    const detail = response.status_detail ?? response.status ?? "sem detalhe";
    throw new PaymentProviderError(
      `MercadoPago recusou o pagamento (${detail}).`,
      "provider_unavailable",
    );
  }
  return "pending";
}

/**
 * `true` quando a order está em **análise antifraude** no MP: `status` cru
 * `processing` ou `status_detail` `in_process`. Olhamos o status CRU (não o
 * `mapMpStatus`, que colapsa tudo em `pending`) porque o client precisa
 * distinguir "em análise" de "gerando o artefato".
 */
function isUnderReview(response: OrderResponse): boolean {
  return response.status === "processing" || response.status_detail === "in_process";
}

/** Cria a order no MercadoPago e devolve o necessário para o client concluir. */
export async function createOrder(input: CreatePaymentInput): Promise<PaymentIntentResult> {
  const { accessToken, timeoutMs, bodyTimeoutMs } = resolveMercadoPagoConfig();
  const sandbox = isMercadoPagoSandbox(accessToken);
  const effectiveInput = sandbox ? withSandboxPayer(input) : input;
  if (sandbox) {
    // Log informativo pra confirmar nos logs qual email/first_name foram enviados
    // ao MP no sandbox. O first_name dispara o status simulado (ex.: "APRO" →
    // action_required com QR); útil pra diferenciar uso explícito das env vars
    // (MERCADOPAGO_SANDBOX_PAYER_*) do default.
    logger.info("[mercadoPago] sandbox detected — payer rewritten", {
      payerEmail: effectiveInput.payer.email,
      payerFirstName: effectiveInput.payer.firstName,
    });
  }
  const body = buildOrderBody(effectiveInput);

  let response: OrderResponse;
  try {
    response = (await mpFetch("/v1/orders", {
      method: "POST",
      headers: buildHeaders(accessToken, input.orderId),
      body: JSON.stringify(body),
      timeoutMs,
      bodyTimeoutMs,
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

  const result: PaymentIntentResult = {
    paymentId: response.id,
    paymentMethod: input.paymentMethod,
    status: mapOrderStatus(response),
    statusDetail: response.status_detail ?? undefined,
  };
  if (isUnderReview(response)) result.underReview = true;

  // PIX/boleto: o artefato (QR / dados do boleto) pode vir de forma assíncrona —
  // o MP responde 2xx sem ele e o gera logo depois. Em vez de falhar, marcamos
  // `*Pending` e o client faz polling via `getOrderArtifacts`. Só uma falha real
  // (pagamento recusado) interrompe — ver `classifyMissingArtifact`.
  if (input.paymentMethod === "pix") {
    const pix = extractPixPayment(response);
    if (pix) {
      result.pix = pix;
    } else {
      classifyMissingArtifact("create", { orderId: input.orderId, paymentMethod: "pix" }, response);
      result.pixPending = true;
    }
  }

  if (input.paymentMethod === "boleto") {
    const boleto = extractBoletoPayment(response);
    if (boleto) {
      result.boleto = boleto;
    } else {
      classifyMissingArtifact(
        "create",
        { orderId: input.orderId, paymentMethod: "boleto" },
        response,
      );
      result.boletoPending = true;
    }
  }

  return result;
}

/**
 * Relê uma order no MercadoPago e extrai o artefato de pagamento (QR do PIX /
 * dados do boleto) quando já disponível. Usado pelo polling client-side enquanto
 * `pixPending`/`boletoPending`. Não persiste nada — só consulta.
 */
export async function getOrderArtifacts(mpOrderId: string): Promise<OrderArtifacts> {
  const { accessToken, timeoutMs, bodyTimeoutMs } = resolveMercadoPagoConfig();

  let response: OrderResponse;
  try {
    response = (await mpFetch(`/v1/orders/${encodeURIComponent(mpOrderId)}`, {
      method: "GET",
      headers: buildHeaders(accessToken),
      timeoutMs,
      bodyTimeoutMs,
    })) as OrderResponse;
  } catch (err) {
    if (err instanceof PaymentProviderError) throw err;
    throw logAndRewrapMpError("get", { mpOrderId }, err);
  }

  const status = mapOrderStatus(response);
  const pix = extractPixPayment(response) ?? undefined;
  const boleto = extractBoletoPayment(response) ?? undefined;

  // Sem artefato ainda: loga o body cru e, se o pagamento já falhou, lança (o
  // client para de pollar). Caso pendente, devolve só o status — o client segue
  // tentando.
  if (!pix && !boleto && FAILURE_STATUSES.has(status)) {
    classifyMissingArtifact("get", { orderId: response.external_reference ?? mpOrderId, paymentMethod: response.transactions?.payments?.[0]?.payment_method?.type ?? "unknown" }, response);
  }

  return { status, pix, boleto, underReview: isUnderReview(response) || undefined };
}

/** Consulta uma order no MercadoPago — usado pelo webhook para confirmar. */
export async function getOrder(orderId: string): Promise<ProviderPaymentSummary> {
  const { accessToken, timeoutMs, bodyTimeoutMs } = resolveMercadoPagoConfig();

  let response: OrderResponse;
  try {
    response = (await mpFetch(`/v1/orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      headers: buildHeaders(accessToken),
      timeoutMs,
      bodyTimeoutMs,
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

  const status = mapOrderStatus(response);
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

  // A doc do MP é internamente contraditória sobre o segmento `request-id` quando
  // o header x-request-id está AUSENTE: o WARNING manda REMOVER o segmento
  // (`id:..;ts:..;`), mas os exemplos de SDK montam `request-id:$xRequestId;`
  // (vazio). Como o lado que ASSINA (servidores do MP) não está documentado de
  // forma inequívoca — e o simulador/teste do painel não envia x-request-id —
  // testamos as duas variantes e aceitamos se QUALQUER uma casar. Quando o header
  // existe (notificações reais de Order), só há uma variante, sem ambiguidade.
  const candidates = requestId
    ? [`id:${normalizedId};request-id:${requestId};ts:${ts};`]
    : [
        `id:${normalizedId};ts:${ts};`, // WARNING da doc: remover segmento ausente
        `id:${normalizedId};request-id:;ts:${ts};`, // exemplos de SDK: segmento vazio
      ];

  const secret = resolveWebhookSecret();
  const receivedBuf = Buffer.from(v1, "hex");
  return candidates.some((manifest) => {
    const expectedBuf = Buffer.from(
      createHmac("sha256", secret).update(manifest).digest("hex"),
      "hex",
    );
    return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf);
  });
}
