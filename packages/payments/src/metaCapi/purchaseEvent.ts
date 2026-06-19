/**
 * Montagem + envio do evento `Purchase` da Conversions API (CAPI).
 *
 * Mantido **livre de Firestore/firebase-admin** (a orquestração com I/O mora em
 * `notify.ts`) para que o builder puro e o sender sejam testáveis sem mockar o
 * Admin SDK.
 *
 * `buildPurchaseEventData` é pura; `sendPurchaseEvent` faz o POST via `capiFetch`.
 * Ambos compõem o `Purchase` server-side que reforça o `Purchase` do Pixel no
 * navegador — como os dois usam `event_id = order.id`, o Meta deduplica e conta
 * a conversão uma única vez.
 */

import type { Order, UserProfile } from "@luratha/schemas";
import { buildEventsUrl, capiFetch, type MetaCapiConfig } from "./client";
import { hashEmail, hashExternalId, hashName, hashPhone } from "./hash";

const CURRENCY = "BRL" as const;

/** `user_data` — todos os campos já hasheados (SHA-256 hex), em arrays. */
export interface MetaUserData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  external_id?: string[];
}

export interface MetaPurchaseContent {
  id: string;
  quantity: number;
  item_price: number;
}

/** Objeto `data[0]` enviado ao endpoint `/events`. */
export interface MetaPurchaseEventData {
  event_name: "Purchase";
  /** Unix em segundos. */
  event_time: number;
  /** = `order.id` — chave de dedupe com o `Purchase` do Pixel (eventID). */
  event_id: string;
  action_source: "website";
  user_data: MetaUserData;
  custom_data: {
    currency: string;
    value: number;
    content_ids: string[];
    contents: MetaPurchaseContent[];
    content_type: "product";
    num_items: number;
    order_id: string;
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Monta o `data[0]` do `Purchase` a partir do pedido + perfil do cliente.
 * Função pura. `now` permite congelar o relógio nos testes (usado só quando o
 * pedido ainda não tem `paidAt`).
 */
export function buildPurchaseEventData(
  order: Order,
  profile: UserProfile | null,
  opts: { now?: number } = {},
): MetaPurchaseEventData {
  const contents: MetaPurchaseContent[] = order.items.map((item) => ({
    id: item.itemSku,
    quantity: item.quantity,
    item_price: item.unitPrice,
  }));

  const userData: MetaUserData = {};
  if (profile?.email) {
    const em = hashEmail(profile.email);
    if (em) userData.em = [em];
  }
  if (profile?.phone) {
    const ph = hashPhone(profile.phone);
    if (ph) userData.ph = [ph];
  }
  if (profile?.firstName) {
    const fn = hashName(profile.firstName);
    if (fn) userData.fn = [fn];
  }
  if (profile?.lastName) {
    const ln = hashName(profile.lastName);
    if (ln) userData.ln = [ln];
  }
  const externalId = hashExternalId(order.userId);
  if (externalId) userData.external_id = [externalId];

  const eventTimeMs = order.paidAt ? new Date(order.paidAt).getTime() : (opts.now ?? Date.now());

  return {
    event_name: "Purchase",
    event_time: Math.floor(eventTimeMs / 1000),
    event_id: order.id,
    action_source: "website",
    user_data: userData,
    custom_data: {
      currency: order.currency || CURRENCY,
      value: round2(order.grandTotal),
      content_ids: contents.map((c) => c.id),
      contents,
      content_type: "product",
      num_items: order.itemCount,
      order_id: order.id,
    },
  };
}

/** Envia um `Purchase` montado ao endpoint `/{pixelId}/events`. */
export async function sendPurchaseEvent(
  config: MetaCapiConfig,
  pixelId: string,
  data: MetaPurchaseEventData,
): Promise<void> {
  const payload: Record<string, unknown> = {
    data: [data],
    access_token: config.accessToken,
  };
  if (config.testEventCode) payload.test_event_code = config.testEventCode;
  await capiFetch(buildEventsUrl(config.apiVersion, pixelId), payload, config);
}
