import { logger } from "@luratha/core/logging/logger";
import { flattenError } from "@luratha/core/logging/serializeLogPayload";
import { ApiResponseError } from "@/src/lib/errors";

/**
 * Etapas do checkout reconhecidas pelo mapper de mensagens. Cada step tem seu
 * próprio conjunto de mensagens amigáveis em PT-BR — ver `pickFriendlyMessage`.
 */
export type CheckoutStep =
  | "identification"
  | "address_load"
  | "address_save"
  | "shipping"
  | "payment_card"
  | "payment_pix"
  | "payment_boleto"
  | "submit_order"
  | "coupon"
  | "boundary";

export interface ReportCheckoutErrorArgs {
  error: unknown;
  step: CheckoutStep;
  /**
   * Contexto adicional para o log e para o mapper. Caso especial reconhecido:
   * `hasFieldIssues: true` no step `address_save` faz o banner colapsar para
   * "Confira os campos destacados abaixo." (os erros por campo já comunicam
   * o detalhe via `AddressForm`).
   */
  metadata?: Record<string, unknown>;
}

interface LogPayload {
  step: CheckoutStep;
  timestamp: string;
  errorName: string;
  message: string;
  status?: number;
  code?: string;
  metadata?: Record<string, unknown>;
  [k: string]: unknown;
}

function buildLogPayload({ error, step, metadata }: ReportCheckoutErrorArgs): LogPayload {
  const payload: LogPayload = {
    step,
    timestamp: new Date().toISOString(),
    errorName: "unknown",
    message: "",
  };
  if (metadata) payload.metadata = metadata;

  // `flattenError` cobre `Error` e subclasses (`ApiResponseError`, `TypeError`).
  // Props enumeráveis customizadas (`status`, `code`, `issues`) entram
  // automaticamente. `stack` é intencionalmente omitido — Cloud Logging
  // mantém stacks separadamente.
  const flat = flattenError(error);
  if (flat) {
    const { name, message, ...rest } = flat;
    payload.errorName = name;
    payload.message = message;
    Object.assign(payload, rest);
    return payload;
  }

  // `DOMException` não estende `Error` em jsdom (estende em browsers reais);
  // tratamos explicitamente pra preservar o `name` (ex.: "AbortError").
  if (error instanceof DOMException) {
    payload.errorName = error.name;
    payload.message = error.message;
    return payload;
  }

  payload.message = typeof error === "string" ? error : String(error);
  return payload;
}

const CROSS = {
  abort: "A operação demorou demais. Verifique sua conexão e tente novamente.",
  network: "Sua conexão parece instável. Verifique a internet e tente novamente.",
  unauthorized: "Sua sessão expirou. Atualize a página e entre de novo para continuar.",
  forbidden: "Você não tem permissão para realizar esta ação.",
  serverGeneric: "Tivemos um problema momentâneo no servidor. Tente novamente em instantes.",
  serverInstability: "Estamos com instabilidade no momento. Tente novamente em alguns minutos.",
} as const;

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isApi(error: unknown): error is ApiResponseError {
  return error instanceof ApiResponseError;
}

function pickFriendlyMessage(args: ReportCheckoutErrorArgs): string {
  const { error, step, metadata } = args;

  if (isAbort(error)) {
    if (step === "submit_order") {
      return "O pagamento demorou demais para responder. Aguarde alguns instantes — se já foi cobrado, ele aparecerá em “Meus pedidos”.";
    }
    return CROSS.abort;
  }

  if (error instanceof TypeError) {
    return CROSS.network;
  }

  if (isApi(error)) {
    const { status, code } = error;

    if (status === 401) return CROSS.unauthorized;
    if (status === 403) return CROSS.forbidden;

    // Steps que reconhecem `code` discriminam **antes** do fallback por status,
    // pra que `provider_unavailable` ganhe copy específica em vez de cair no
    // genérico "Estamos com instabilidade".
    switch (step) {
      case "shipping":
        if (code === "invalid_input") {
          return "Confira o CEP informado e tente novamente.";
        }
        if (code === "not_supported") {
          return "Não atendemos a esse CEP no momento.";
        }
        if (code === "provider_unavailable") {
          return "As transportadoras estão indisponíveis no momento. Tente novamente em alguns minutos.";
        }
        if (code === "config_missing") {
          return "Não conseguimos calcular o frete agora. Tente novamente em instantes.";
        }
        break;
      case "payment_pix":
      case "payment_boleto":
        if (code === "invalid_input") {
          return "Confira os dados de pagamento e tente novamente.";
        }
        if (code === "provider_unavailable") {
          return "O Mercado Pago está indisponível no momento. Tente novamente em alguns minutos.";
        }
        if (code === "config_missing") {
          return "Não conseguimos processar o pagamento agora. Tente novamente em instantes.";
        }
        break;
      case "submit_order":
        if (code === "invalid_input") {
          return "Confira os dados de pagamento e tente novamente.";
        }
        if (code === "provider_unavailable") {
          return "O Mercado Pago está indisponível no momento. Tente novamente em alguns minutos.";
        }
        break;
      default:
        break;
    }

    if (status >= 502 && status <= 504) return CROSS.serverInstability;

    switch (step) {
      case "identification":
        if (status === 400) {
          return "Confira os dados informados — CPF/CNPJ ou e-mail parecem inválidos.";
        }
        if (status === 404) {
          return "Não conseguimos criar seu perfil agora. Tente novamente em instantes.";
        }
        if (status === 409) {
          return "Já existe um perfil com esses dados. Atualize a página e tente de novo.";
        }
        if (status >= 500) return CROSS.serverGeneric;
        return "Não foi possível salvar seus dados. Tente novamente.";

      case "address_load":
        if (status >= 500) {
          return "Não conseguimos carregar seus endereços agora. Tente novamente em instantes.";
        }
        return "Não conseguimos carregar seus endereços. Atualize a página e tente de novo.";

      case "address_save":
        if (status === 400) {
          if (metadata?.hasFieldIssues) {
            return "Confira os campos destacados abaixo.";
          }
          return "Não foi possível salvar este endereço. Verifique os dados e tente novamente.";
        }
        if (status === 409) {
          return "Este endereço já está cadastrado na sua conta.";
        }
        if (status >= 500) return CROSS.serverGeneric;
        return "Não foi possível salvar o endereço. Tente novamente.";

      case "shipping":
        if (status >= 500) {
          return "Não conseguimos calcular o frete agora. Tente novamente em instantes.";
        }
        return "Não foi possível calcular o frete. Tente novamente.";

      case "payment_pix":
      case "payment_boleto":
        if (status >= 500) {
          return "Não conseguimos processar o pagamento agora. Tente novamente em instantes.";
        }
        return "Não foi possível processar o pagamento. Tente novamente.";

      case "submit_order":
        if (status === 400) {
          return "Faltam dados ou eles estão inválidos. Volte ao carrinho e refaça o pedido.";
        }
        if (status === 409) {
          return "Detectamos uma duplicação. Atualize a página antes de tentar de novo.";
        }
        if (status === 422) {
          return "Não conseguimos processar este pedido. Verifique os dados e tente novamente.";
        }
        if (status >= 500) {
          return "Não conseguimos processar o pagamento agora. Tente novamente em instantes.";
        }
        return "Não foi possível concluir o pedido. Tente novamente.";

      case "coupon":
        if (status >= 500) {
          return "Não foi possível validar o cupom agora. Tente novamente em instantes.";
        }
        return "Não foi possível validar o cupom. Verifique o código e tente novamente.";

      case "payment_card":
      case "boundary":
        // Esses steps não recebem ApiResponseError em fluxo normal — caem no
        // fallback abaixo.
        break;
    }
  }

  // Fallbacks por step para erros não-ApiResponseError / não reconhecidos.
  switch (step) {
    case "identification":
      return "Não foi possível salvar seus dados. Tente novamente.";
    case "address_load":
      return "Não foi possível carregar seus endereços.";
    case "address_save":
      return "Não foi possível salvar o endereço. Tente novamente.";
    case "payment_card": {
      // O `onError` do Brick dispara em falhas de setup/tokenização — NÃO em
      // recusas de cartão (essas vêm pela API do payment-intent, step
      // `submit_order`). Discriminamos `metadata.brickCause` pra dar copy
      // específica nas falhas conhecidas.
      const cause = typeof metadata?.brickCause === "string" ? metadata.brickCause : "";
      if (cause === "fields_setup_failed" || cause === "get_payment_methods_failed") {
        return "Não conseguimos carregar o formulário de cartão. Recarregue a página ou escolha PIX/Boleto.";
      }
      if (cause === "card_token_creation_failed") {
        return "Não conseguimos validar os dados do cartão. Confira número, validade e CVV e tente novamente.";
      }
      return "Não foi possível processar o cartão. Confira os dados ou tente outro método de pagamento.";
    }
    case "shipping":
      return "Não foi possível calcular o frete. Tente novamente.";
    case "payment_pix":
    case "payment_boleto":
    case "submit_order":
      return "Não foi possível concluir o pedido. Tente novamente.";
    case "coupon":
      return "Não foi possível validar o cupom.";
    case "boundary":
      return "Algo deu errado. Recarregue a página e tente novamente.";
  }
}

/**
 * Decide entre `severity=WARNING` (erro esperado do cliente) e
 * `severity=ERROR` (falha de infraestrutura / erro inesperado), seguindo
 * o padrão estabelecido em `CartContext` (401 transitório vai como warn).
 *
 * - 4xx (validação, sessão expirada, recurso não encontrado) → WARNING
 * - TypeError (queda de conexão do lado do cliente) → WARNING
 * - 5xx, AbortError, boundary, desconhecido → ERROR
 *
 * Cloud Logging filtra `severity=ERROR` pra identificar outages reais; sem
 * essa separação, typos de cupom (404) e CPFs inválidos (400) poluem o
 * bucket e enterram falhas reais do MercadoPago.
 */
function pickSeverity({ error, step }: ReportCheckoutErrorArgs): "warn" | "error" {
  if (step === "boundary") return "error";
  if (error instanceof DOMException && error.name === "AbortError") return "error";
  if (error instanceof TypeError) return "warn";
  if (error instanceof ApiResponseError) {
    if (error.status >= 400 && error.status < 500) return "warn";
    return "error";
  }
  return "error";
}

/**
 * Centraliza o tratamento de erros do checkout: emite um log estruturado via
 * `@luratha/core/logging/logger` e devolve uma mensagem amigável em PT-BR
 * para o cliente.
 *
 * Severidade é roteada por `pickSeverity` (4xx/TypeError → WARN, demais →
 * ERROR) pra alinhar com o uso do Cloud Logging em produção. O payload
 * (`step`, `errorName`, `status`, `code`, `message`, `metadata`, props
 * customizadas do erro) é queryável via `jsonPayload.payload.<path>`.
 */
export function reportCheckoutError(args: ReportCheckoutErrorArgs): string {
  const payload = buildLogPayload(args);
  const severity = pickSeverity(args);
  logger[severity](`[checkout:${args.step}]`, payload);
  return pickFriendlyMessage(args);
}
