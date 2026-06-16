/**
 * Camada fina sobre o `fbq` global do Meta (Facebook) Pixel.
 *
 * O script base (fbevents.js + `init` + consentimento) é injetado por
 * `components/analytics/MetaPixel.tsx`. Aqui ficam só os helpers de disparo de
 * evento, todos defensivos: se o `fbq` não estiver presente (Pixel desligado no
 * admin, ou ainda não carregado), viram no-op silencioso em vez de quebrar.
 *
 * Espelha o padrão de `gtag.ts` (GA4). A escolha de opt-out é **compartilhada**
 * com o GA4 — a mesma chave `GA_CONSENT_STORAGE_KEY` governa ambos (ver
 * `consent.ts`), então o visitante decide uma vez e vale para análise e anúncios.
 */

import type { ConsentValue } from "./gtag";

/** Comandos do `fbq` que usamos. `string` cobre o resto da API sem fricção. */
type FbqCommand = "init" | "track" | "trackCustom" | "consent" | "set";

declare global {
  interface Window {
    fbq?: (command: FbqCommand, ...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

/** Opções de disparo. `eventID` habilita a deduplicação com a Conversions API. */
export interface PixelEventOptions {
  /** Mesmo id usado no evento server-side (CAPI) para o Meta deduplicar. */
  eventID?: string;
}

/**
 * Dispara um evento padrão do Pixel. No-op quando `window.fbq` não existe (SSR,
 * Pixel desligado, ou script ainda não carregado). Quando `eventID` é fornecido,
 * é enviado como 4º argumento para o Meta casar este hit com o equivalente da
 * Conversions API (mesmo `event_id`) e contar a conversão uma única vez.
 */
export function trackPixelEvent(
  name: string,
  params: Record<string, unknown> = {},
  opts?: PixelEventOptions,
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (opts?.eventID) {
    window.fbq("track", name, params, { eventID: opts.eventID });
  } else {
    window.fbq("track", name, params);
  }
}

/**
 * Envia um `PageView` manual nas navegações SPA do App Router. O `PageView`
 * inicial já é disparado pelo bootstrap inline de `MetaPixel.tsx`.
 */
export function pixelPageview(): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", "PageView");
}

/**
 * Reflete a escolha de consentimento no Pixel: `granted` → `grant`,
 * `denied` → `revoke`. No modo `revoke` o Pixel retém os eventos até um novo
 * `grant`. Chamado por `setConsentChoice` (junto do `consent update` do GA4).
 */
export function updatePixelConsent(choice: ConsentValue): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("consent", choice === "denied" ? "revoke" : "grant");
}
