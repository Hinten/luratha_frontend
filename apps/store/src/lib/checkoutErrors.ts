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
  stack?: string;
}

function buildLogPayload({ error, step, metadata }: ReportCheckoutErrorArgs): LogPayload {
  const payload: LogPayload = {
    step,
    timestamp: new Date().toISOString(),
    errorName: "unknown",
    message: "",
  };
  if (metadata) payload.metadata = metadata;

  if (error instanceof ApiResponseError) {
    payload.errorName = error.name;
    payload.message = error.message;
    payload.status = error.status;
    if (error.code) payload.code = error.code;
    if (error.stack) payload.stack = error.stack;
    return payload;
  }

  if (error instanceof DOMException) {
    payload.errorName = error.name;
    payload.message = error.message;
    return payload;
  }

  if (error instanceof Error) {
    payload.errorName = error.name || error.constructor.name;
    payload.message = error.message;
    if (error.stack) payload.stack = error.stack;
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
    case "shipping":
      return "Não foi possível calcular o frete. Tente novamente.";
    case "payment_card":
      return "Não foi possível processar o cartão. Confira os dados ou tente outro método de pagamento.";
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
 * Centraliza o tratamento de erros do checkout: registra um log estruturado
 * (console.error por enquanto — migra pro logger do projeto quando o PR #139
 * aterrissar) e devolve uma mensagem amigável em PT-BR para o cliente.
 *
 * O payload do log mantém o formato estruturado (`step`, `errorName`, `status`,
 * `code`, `message`, `metadata`, `stack`) pronto para ser plugado num logger
 * remoto sem mudar os call sites.
 */
export function reportCheckoutError(args: ReportCheckoutErrorArgs): string {
  const payload = buildLogPayload(args);
  console.error(`[checkout:${args.step}]`, payload);
  return pickFriendlyMessage(args);
}
