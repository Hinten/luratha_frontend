/**
 * Persistência e aplicação da escolha de consentimento (Consent Mode v2).
 *
 * Modelo **opt-out**: o default é `granted` para todos os sinais (definido no
 * script inline de `Analytics.tsx`, antes das tags dispararem). O visitante
 * pode **recusar** na página de Política de Dados; a escolha é gravada aqui e
 * reaplicada antes das tags nas próximas visitas (também pelo script inline).
 *
 * Estados possíveis em `localStorage[GA_CONSENT_STORAGE_KEY]`:
 * - ausente  → sem escolha explícita; vale o default `granted`.
 * - "granted" → o visitante permitiu explicitamente (reverteu um opt-out).
 * - "denied"  → o visitante recusou análise e anúncios (opt-out).
 */

import {
  GA_CONSENT_STORAGE_KEY,
  updateConsent,
  type ConsentSignal,
  type ConsentValue,
} from "./gtag";
import { updatePixelConsent } from "./fbq";

export type ConsentChoice = ConsentValue | null;

const CONSENT_SIGNALS: ConsentSignal[] = [
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "analytics_storage",
];

function allSignals(value: ConsentValue): Record<ConsentSignal, ConsentValue> {
  return Object.fromEntries(CONSENT_SIGNALS.map((s) => [s, value])) as Record<
    ConsentSignal,
    ConsentValue
  >;
}

/** Lê a escolha persistida. `null` = sem escolha explícita (default granted). */
export function readConsentChoice(): ConsentChoice {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GA_CONSENT_STORAGE_KEY);
    return raw === "granted" || raw === "denied" ? raw : null;
  } catch (err) {
    if (err instanceof DOMException) {
      // Storage bloqueado (modo privado, política de quota) — trata como sem escolha.
      return null;
    }
    throw err;
  }
}

function persistConsentChoice(choice: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GA_CONSENT_STORAGE_KEY, choice);
  } catch (err) {
    if (err instanceof DOMException) {
      // Storage indisponível — a escolha vale só nesta sessão (update já foi aplicado).
      return;
    }
    throw err;
  }
}

/**
 * Aplica e persiste uma escolha do visitante: grava no `localStorage`, dispara
 * o `consent update` do GA4 (4 sinais no mesmo valor) e reflete a escolha no
 * Meta Pixel (`grant`/`revoke`). Uma única escolha governa análise e anúncios em
 * ambas as plataformas. Usado pelos botões Recusar/Permitir do controle de
 * opt-out.
 */
export function setConsentChoice(choice: ConsentValue): void {
  persistConsentChoice(choice);
  updateConsent(allSignals(choice));
  updatePixelConsent(choice);
}
