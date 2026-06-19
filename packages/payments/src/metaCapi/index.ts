/**
 * Superfície pública da integração com a Meta Conversions API (CAPI).
 *
 * O consumidor é o webhook do MercadoPago (`apps/mercadopago/`), que chama
 * `notifyPurchaseConversion(orderId)` após um pedido transicionar para `paid`.
 */

export {
  buildEventsUrl,
  capiFetch,
  MetaCapiError,
  resolveMetaCapiConfig,
  type MetaCapiConfig,
  type MetaCapiErrorCode,
} from "./client";

export {
  buildPurchaseEventData,
  sendPurchaseEvent,
  type MetaPurchaseContent,
  type MetaPurchaseEventData,
  type MetaUserData,
} from "./purchaseEvent";

export { notifyPurchaseConversion } from "./notify";

export { hashEmail, hashExternalId, hashName, hashPhone } from "./hash";
