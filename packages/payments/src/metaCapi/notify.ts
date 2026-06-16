/**
 * Orquestração não-bloqueante do `Purchase` server-side (Conversions API).
 *
 * Isola o I/O (Firestore via Admin SDK, POST à Graph API) do builder puro em
 * `purchaseEvent.ts`. Chamado pelo webhook do MercadoPago quando um pedido
 * transiciona para `paid`.
 *
 * Garantias:
 * - **Opcional**: sem `META_CAPI_ACCESS_TOKEN`, vira no-op silencioso.
 * - **Governado pelo admin**: pula quando `metaPixelEnabled` é falso ou
 *   `metaPixelId` está vazio em `settings/global.marketing` — uma única fonte
 *   de verdade controla Pixel (navegador) e CAPI (servidor).
 * - **Não-bloqueante**: toda falha esperada vira `MetaCapiError`, é logada como
 *   warning e engolida — analytics nunca quebra o webhook de pagamento.
 */

import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminSiteSettingsConverter } from "@luratha/firestore/adminSiteSettingsConverter";
import { adminUserProfileConverter } from "@luratha/firestore/adminUserProfileConverter";
import {
  firestoreCollections,
  getDefaultSiteSettings,
  SITE_SETTINGS_DOC_ID,
  type MarketingSettings,
  type Order,
  type UserProfile,
} from "@luratha/schemas";
import { logger } from "@luratha/core/logging/logger";
import { loadOrder } from "../orderService";
import { MetaCapiError, resolveMetaCapiConfig } from "./client";
import { buildPurchaseEventData, sendPurchaseEvent } from "./purchaseEvent";

async function readMarketingSettings(): Promise<MarketingSettings> {
  try {
    // eslint-disable-next-line no-restricted-syntax -- leitura read-only de settings/global ligada ao adminSiteSettingsConverter; o gating da CAPI não escreve nada
    const snap = await adminDb
      .collection(firestoreCollections.settings)
      .doc(SITE_SETTINGS_DOC_ID)
      .withConverter(adminSiteSettingsConverter)
      .get();
    const settings = snap.exists ? snap.data()! : getDefaultSiteSettings();
    return settings.marketing;
  } catch (err) {
    throw new MetaCapiError("Falha ao ler settings/global.", "unknown", err);
  }
}

async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    // eslint-disable-next-line no-restricted-syntax -- leitura read-only do userProfile (email/telefone p/ matching) ligada ao adminUserProfileConverter; não escreve nada
    const snap = await adminDb
      .collection(firestoreCollections.userProfiles)
      .doc(uid)
      .withConverter(adminUserProfileConverter)
      .get();
    return snap.exists ? snap.data()! : null;
  } catch (err) {
    throw new MetaCapiError("Falha ao ler userProfile.", "unknown", err);
  }
}

async function loadPaidOrder(orderId: string): Promise<Order | null> {
  try {
    return await loadOrder(orderId);
  } catch (err) {
    throw new MetaCapiError("Falha ao carregar o pedido.", "unknown", err);
  }
}

/**
 * Envia o `Purchase` server-side para um pedido pago. Ver as garantias no topo
 * do arquivo. Nunca lança por falhas de envio/leitura esperadas.
 */
export async function notifyPurchaseConversion(orderId: string): Promise<void> {
  try {
    const config = resolveMetaCapiConfig();
    if (!config) {
      // CAPI opcional — sem token, só o Pixel do navegador mede. Sem ruído.
      return;
    }

    const marketing = await readMarketingSettings();
    if (!marketing.metaPixelEnabled || !marketing.metaPixelId) {
      logger.info("[metaCapi] Pixel desligado ou sem ID — pulando Purchase server-side", {
        orderId,
      });
      return;
    }

    const order = await loadPaidOrder(orderId);
    if (!order) {
      logger.warn("[metaCapi] pedido não encontrado para o Purchase server-side", { orderId });
      return;
    }

    const profile = await loadUserProfile(order.userId);
    const data = buildPurchaseEventData(order, profile);
    await sendPurchaseEvent(config, marketing.metaPixelId, data);

    logger.info("[metaCapi] Purchase server-side enviado", { orderId, eventId: order.id });
  } catch (err) {
    if (err instanceof MetaCapiError) {
      // Swallow proposital — analytics nunca quebra o webhook de pagamento.
      logger.warn("[metaCapi] falha ao enviar o Purchase server-side", { orderId, err });
      return;
    }
    throw err;
  }
}
