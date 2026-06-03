/**
 * Public surface of @luratha/payments.
 *
 * Provider adapter (`mercadoPago/*`) and order orchestration (`orderService.ts`)
 * are kept as separate modules; this barrel re-exports the symbols that
 * consumers (the storefront's payment-intent endpoint, the standalone webhook
 * app) actually use.
 */

export {
  createOrder,
  describeMercadoPagoError,
  getOrder,
  getOrderArtifacts,
  isMercadoPagoSandbox,
  mapMpStatus,
  verifyWebhookSignature,
  withSandboxPayer,
} from "./mercadoPago";

export {
  applyOrderWebhook,
  createPaymentIntent,
  loadOrder,
  type PaymentIntentMethodInput,
} from "./orderService";

export {
  PaymentProviderError,
  type BoletoArtifact,
  type CreateBoletoPaymentInput,
  type CreateCardPaymentInput,
  type CreatePaymentInput,
  type CreatePixPaymentInput,
  type OrderArtifacts,
  type PaymentIntentResult,
  type PaymentMethod,
  type PaymentPayer,
  type PaymentPayerAddress,
  type PaymentProviderErrorCode,
  type PaymentStatus,
  type PixArtifact,
  type ProviderPaymentSummary,
} from "./types";
