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
 * Status de pagamento normalizado — espelha `Order.paymentStatus`. A API de
 * Orders do MP usa `status` (grosso) + `status_detail` (substatus); `mapMpStatus`
 * (`mercadoPago/index.ts`) combina os dois (e o método) pra produzir estes
 * valores. `unknown` é o fail-safe pra qualquer status que não reconheçamos —
 * persistido (não silenciado) pra forçar revisão manual, nunca despachar um
 * pedido sob status incerto.
 */
export type PaymentStatus =
  | "pending"
  | "awaiting_pix"
  | "awaiting_boleto"
  | "authorized"
  | "paid"
  | "partially_refunded"
  | "in_dispute"
  | "failed"
  | "refunded"
  | "charged_back"
  | "unknown";

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
  /** Presente quando `paymentMethod === "pix"` e o QR já foi gerado. */
  pix?: PixArtifact;
  /**
   * PIX criado, mas o MP ainda não devolveu o QR Code (geração assíncrona).
   * O client deve consultar `GET /api/checkout/payment-intent` até o QR chegar.
   */
  pixPending?: boolean;
  /** Presente quando `paymentMethod === "boleto"` e o boleto já foi gerado. */
  boleto?: BoletoArtifact;
  /**
   * Boleto criado, mas o MP ainda não devolveu os dados (`ticket_url`). O client
   * deve consultar `GET /api/checkout/payment-intent` até o boleto chegar.
   */
  boletoPending?: boolean;
  /**
   * Pagamento em **análise antifraude** no MP (`status: processing` /
   * `status_detail: in_process`). O artefato ainda não saiu porque a transação
   * está sendo validada; o client mostra "pagamento em análise" em vez de
   * "gerando…". Continua pendente (poll) — a análise pode liberar e gerar o QR.
   */
  underReview?: boolean;
}

export interface PixArtifact {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl?: string;
  expiresAt?: string;
}

export interface BoletoArtifact {
  url: string;
  barcode?: string;
  digitableLine?: string;
}

/**
 * Resultado da releitura de uma order no provider durante o polling do artefato
 * (PIX QR / boleto). Devolvido pelo `GET /api/checkout/payment-intent`.
 */
export interface OrderArtifacts {
  status: PaymentStatus;
  pix?: PixArtifact;
  boleto?: BoletoArtifact;
  /** Pagamento em análise antifraude (vide `PaymentIntentResult.underReview`). */
  underReview?: boolean;
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
