/**
 * Contratos da integração de pagamento.
 *
 * A camada espelha `src/lib/shipping/` — tipos + adapter (MercadoPago) +
 * service de orquestração + classe de erro própria. Há um único provider
 * (MercadoPago Checkout Transparente), então não existe registry plugável:
 * caso surja um segundo provider, extrair uma interface aqui.
 */

/** Método de pagamento — espelha `Order.paymentMethod`. */
export type PaymentMethod = "pix" | "credit_card" | "boleto";

/**
 * Status de pagamento normalizado — espelha `Order.paymentStatus`.
 *
 * O adapter MercadoPago (API de Orders) só produz quatro estados terminais:
 * `paid`, `refunded`, `failed`, `pending`. Estados intermediários do antigo
 * Payments API (`authorized` pra cartão pré-autorizado, `in_dispute` /
 * `charged_back` pra fluxo de contestação) não têm equivalente direto na
 * Orders API e foram removidos do union. Se a Orders API expor essas
 * semânticas no futuro, basta adicionar o mapeamento em `mapMpStatus`
 * (`mercadoPago/index.ts`) e reintroduzir o membro aqui.
 */
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

/** Dados do pagador exigidos pelo MercadoPago. */
export interface PaymentPayer {
  email: string;
  firstName?: string;
  lastName?: string;
  identification: {
    type: "CPF" | "CNPJ";
    /** Somente dígitos (11 para CPF, 14 para CNPJ). */
    number: string;
  };
}

/** Endereço do pagador — obrigatório para boleto (exigência do MercadoPago). */
export interface PaymentPayerAddress {
  zipCode: string;
  streetName: string;
  streetNumber: string;
  neighborhood: string;
  city: string;
  federalUnit: string;
}

interface BaseCreatePaymentInput {
  /** Id do pedido (`Order.id`) — vira `external_reference` no MercadoPago. */
  orderId: string;
  /** Valor total a cobrar em BRL (`Order.grandTotal`). */
  amount: number;
  description: string;
  payer: PaymentPayer;
}

export interface CreatePixPaymentInput extends BaseCreatePaymentInput {
  paymentMethod: "pix";
}

export interface CreateCardPaymentInput extends BaseCreatePaymentInput {
  paymentMethod: "credit_card";
  /** Token gerado pelo Card Payment Brick (nunca o número do cartão). */
  cardToken: string;
  installments: number;
  /** Bandeira resolvida no browser pelo Brick (ex.: "visa", "master"). */
  paymentMethodId: string;
}

export interface CreateBoletoPaymentInput extends BaseCreatePaymentInput {
  paymentMethod: "boleto";
  payerAddress: PaymentPayerAddress;
}

export type CreatePaymentInput =
  | CreatePixPaymentInput
  | CreateCardPaymentInput
  | CreateBoletoPaymentInput;

/** Resultado devolvido ao client para concluir o pagamento. */
export interface PaymentIntentResult {
  /** Id do pagamento no MercadoPago — persistido em `Order.paymentIntentId`. */
  paymentId: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  /** Detalhe textual do provider (motivo de recusa de cartão, etc.). */
  statusDetail?: string;
  /** Presente quando `paymentMethod === "pix"`. */
  pix?: {
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl?: string;
    expiresAt?: string;
  };
  /** Presente quando `paymentMethod === "boleto"`. */
  boleto?: {
    url: string;
    barcode?: string;
    digitableLine?: string;
  };
}

/** Resumo de um pagamento consultado no provider (usado pelo webhook). */
export interface ProviderPaymentSummary {
  paymentId: string;
  status: PaymentStatus;
  /** `external_reference` — corresponde ao `Order.id`. */
  orderId: string;
  /** ISO-8601 da aprovação, quando houver. */
  approvedAt?: string;
}

export type PaymentProviderErrorCode =
  | "config_missing"
  | "invalid_input"
  | "provider_unavailable"
  | "unknown";

export class PaymentProviderError extends Error {
  readonly code: PaymentProviderErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: PaymentProviderErrorCode, cause?: unknown) {
    super(message);
    this.name = "PaymentProviderError";
    this.code = code;
    this.cause = cause;
  }
}
