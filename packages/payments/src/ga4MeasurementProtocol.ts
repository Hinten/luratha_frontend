import "server-only";

import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminSiteSettingsConverter } from "@luratha/firestore/adminSiteSettingsConverter";
import { firestoreCollections, SITE_SETTINGS_DOC_ID, type Order } from "@luratha/schemas";
import { logger } from "@luratha/core/logging/logger";

/**
 * Envio server-side do evento `purchase` via GA4 Measurement Protocol.
 *
 * Usado pelo webhook (`applyOrderWebhook`) para contar a venda **somente
 * quando o pagamento confirma de forma assíncrona** — PIX, boleto ou cartão
 * liberado depois da análise antifraude. O cartão aprovado na hora continua
 * sendo medido client-side na página de sucesso; os dois caminhos são
 * mutuamente exclusivos (ver `apps/store/.../sucesso/[orderId]/page.tsx` e
 * `applyOrderWebhook`). Assim a receita do GA4 reflete só pedidos pagos.
 */

const MP_COLLECT_ENDPOINT = "https://www.google-analytics.com/mp/collect";

/** Payload do Measurement Protocol para um único evento `purchase`. */
interface Ga4PurchasePayload {
  client_id: string;
  events: Array<{
    name: "purchase";
    params: {
      transaction_id: string;
      currency: string;
      value: number;
      shipping: number;
      coupon?: string;
      items: Array<{
        item_id: string;
        item_name: string;
        price: number;
        quantity: number;
      }>;
    };
  }>;
}

/**
 * Monta o payload do `purchase` para um pedido pago. Função pura.
 *
 * Retorna `null` quando o pedido não tem `ga4ClientId` (visitante sem cookie
 * `_ga` / opt-out): sem `client_id` o MP não atribui o evento, então não
 * enviamos — em vez de inventar um id sintético, que criaria um usuário
 * fantasma e desrespeitaria o opt-out.
 *
 * `transaction_id` = `order.id`, o MESMO usado no disparo client-side do cartão
 * aprovado na hora — garante a dedup nativa do GA4 por `transaction_id`.
 */
export function buildGa4PurchasePayload(order: Order): Ga4PurchasePayload | null {
  if (!order.ga4ClientId) return null;
  return {
    client_id: order.ga4ClientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: order.id,
          currency: order.currency,
          value: order.grandTotal,
          shipping: order.shippingTotal,
          ...(order.couponCode ? { coupon: order.couponCode } : {}),
          items: order.items.map((item) => ({
            item_id: item.itemSku,
            item_name: item.name,
            price: item.unitPrice,
            quantity: item.quantity,
          })),
        },
      },
    ],
  };
}

/** Measurement ID das settings globais (respeita `ga4Enabled`); `null` se off. */
async function resolveMeasurementId(): Promise<string | null> {
  // eslint-disable-next-line no-restricted-syntax -- leitura read-only do doc de settings, ligada ao schema via adminSiteSettingsConverter; não há escrita. Evita acoplar @luratha/payments a @luratha/repositories só para ler o measurement ID.
  const snapshot = await adminDb
    .collection(firestoreCollections.settings)
    .doc(SITE_SETTINGS_DOC_ID)
    .withConverter(adminSiteSettingsConverter)
    .get();
  if (!snapshot.exists) return null;
  const { marketing } = snapshot.data()!;
  if (!marketing.ga4Enabled || !marketing.ga4MeasurementId) return null;
  return marketing.ga4MeasurementId;
}

/**
 * Envia o `purchase` server-side para um pedido recém-confirmado.
 *
 * No-op (`false`) quando: o pedido não tem `client_id`, GA está desligado/sem
 * measurement ID, ou falta `GA4_API_SECRET` no ambiente. **Nunca lança** — uma
 * falha no GA não pode quebrar o ACK do webhook (o MP reentregaria). Retorna
 * `true` só com resposta 2xx.
 */
export async function sendGa4Purchase(order: Order): Promise<boolean> {
  const payload = buildGa4PurchasePayload(order);
  if (!payload) {
    logger.info("[ga4-mp] purchase pulado: pedido sem ga4ClientId", { orderId: order.id });
    return false;
  }

  const apiSecret = process.env.GA4_API_SECRET;
  if (!apiSecret) {
    logger.warn("[ga4-mp] GA4_API_SECRET ausente — purchase server-side não enviado", {
      orderId: order.id,
    });
    return false;
  }

  const measurementId = await resolveMeasurementId();
  if (!measurementId) {
    logger.info("[ga4-mp] GA4 desligado ou sem measurement ID — purchase não enviado", {
      orderId: order.id,
    });
    return false;
  }

  const url = `${MP_COLLECT_ENDPOINT}?measurement_id=${encodeURIComponent(
    measurementId,
  )}&api_secret=${encodeURIComponent(apiSecret)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.error("[ga4-mp] resposta não-OK do Measurement Protocol", {
        orderId: order.id,
        status: res.status,
      });
      return false;
    }
    logger.info("[ga4-mp] purchase server-side enviado", {
      orderId: order.id,
      value: order.grandTotal,
    });
    return true;
  } catch (err) {
    if (err instanceof TypeError) {
      // Falha de rede do `fetch` — não relança: o webhook precisa dar ACK
      // mesmo assim. Não setar `ga4PurchaseSent` não causa reenvio: numa
      // reentrega o status já será `paid` e o guard `becamePaid` barra.
      logger.error("[ga4-mp] falha de rede ao enviar purchase", { orderId: order.id, err });
      return false;
    }
    throw err;
  }
}
