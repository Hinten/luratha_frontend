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

/**
 * Formato do `client_id` do GA4 (`<n>.<n>`, dois inteiros). Guard server-side:
 * mesmo que um cliente malicioso injete PII (ex.: e-mail) no `ga4ClientId` via
 * POST cru, não enviamos esse valor ao GA4 (política de PII + ruído).
 */
const GA_CLIENT_ID_PATTERN = /^\d+\.\d+$/;

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
 * `_ga` / opt-out) ou quando o valor não tem o formato do GA4 client_id
 * (`<n>.<n>`): sem um `client_id` válido o MP não atribui o evento, então não
 * enviamos — em vez de inventar um id sintético (usuário fantasma + opt-out
 * desrespeitado) ou repassar PII que tenha sido injetada no campo.
 *
 * `transaction_id` = `order.id`, o MESMO usado no disparo client-side do cartão
 * aprovado na hora — garante a dedup nativa do GA4 por `transaction_id`.
 */
export function buildGa4PurchasePayload(order: Order): Ga4PurchasePayload | null {
  if (!order.ga4ClientId || !GA_CLIENT_ID_PATTERN.test(order.ga4ClientId)) return null;
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

  // A leitura das settings (Firestore) e o `fetch` ficam dentro do try: ambos
  // são I/O que pode lançar, e este envio é best-effort — roda DEPOIS do pedido
  // já ter sido persistido como `paid`. NENHUM erro pode escapar: se escapasse,
  // o webhook devolveria 500, o MercadoPago reentregaria e, na reentrega, o
  // pedido já estaria `paid` (guard `becamePaid` barra) → o evento seria
  // perdido de qualquer forma, sem ganho. Logamos e seguimos com `false`.
  try {
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
    // Swallow proposital (caso sancionado — ver CLAUDE.md "No generic catches"):
    // este side-effect best-effort não pode quebrar o ACK do webhook. Cobre
    // falha de rede do `fetch` (`TypeError`), `DOMException`, e erros da leitura
    // de settings no Firestore — todos `Error`. Um `throw` não-Error (raro)
    // ainda propaga, pra não mascarar bug de programação.
    if (err instanceof Error) {
      logger.error("[ga4-mp] falha ao enviar purchase server-side", { orderId: order.id, err });
      return false;
    }
    throw err;
  }
}
