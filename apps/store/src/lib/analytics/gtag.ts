/**
 * Camada fina sobre o `gtag` global do Google Analytics 4.
 *
 * O script base (gtag.js + Consent Mode default) é injetado por
 * `components/analytics/Analytics.tsx`. Aqui ficam só os helpers de disparo de
 * evento, todos defensivos: se o gtag não estiver presente (GA desligado no
 * admin, ou ainda não carregado), viram no-op silencioso em vez de quebrar.
 */

/** Sinais de consentimento do Consent Mode v2. */
export type ConsentSignal =
  | "ad_storage"
  | "ad_user_data"
  | "ad_personalization"
  | "analytics_storage";

export type ConsentValue = "granted" | "denied";

type GtagCommand = "js" | "config" | "event" | "set" | "consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: GtagCommand, ...args: unknown[]) => void;
  }
}

/** Chave única no `localStorage` que guarda a escolha de opt-out do visitante. */
export const GA_CONSENT_STORAGE_KEY = "luratha_consent_v1";

/** Prefixo das chaves de dedupe do evento `purchase` (uma por pedido). */
export const GA_PURCHASE_DEDUP_PREFIX = "ga_purchase_";

/**
 * Dispara um evento GA4. No-op quando `window.gtag` não existe (SSR, GA
 * desligado, ou script ainda não carregado).
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

/**
 * Atualiza o estado de consentimento em runtime (Consent Mode v2 `update`).
 * Usado pelo controle de opt-out da página de Política de Dados.
 */
export function updateConsent(signals: Record<ConsentSignal, ConsentValue>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("consent", "update", signals);
}

/** Envia um `page_view` manual (o `config` usa `send_page_view: false`). */
export function pageview(path: string): void {
  if (typeof window === "undefined") return;
  trackEvent("page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
