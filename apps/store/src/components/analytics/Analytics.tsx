import { Suspense } from "react";
import Script from "next/script";
import { GA_CONSENT_STORAGE_KEY } from "@/src/lib/analytics/gtag";
import PageViewTracker from "./PageViewTracker";

interface AnalyticsProps {
  /** Measurement ID GA4 (`G-XXXXXXXX`). Vazio = analytics desligado. */
  measurementId: string;
}

/**
 * Injeta o Google Analytics 4 com Consent Mode v2 em **modo opt-out**.
 *
 * Ordem garantida:
 * 1. Script inline (no HTML inicial, roda na hora do parse): define
 *    `dataLayer`/`gtag`, seta o consentimento default como `granted` para todos
 *    os sinais e — antes de qualquer tag — reaplica `denied` se o visitante já
 *    tiver recusado numa visita anterior (`localStorage`). Em seguida configura
 *    o GA com `send_page_view: false` (o `PageViewTracker` envia os page_views).
 * 2. gtag.js externo (`afterInteractive`) carrega depois, já com o consentimento
 *    correto aplicado.
 *
 * Renderiza `null` quando não há Measurement ID configurado.
 */
export default function Analytics({ measurementId }: AnalyticsProps) {
  if (!measurementId) return null;

  const bootstrap = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent','default',{'ad_storage':'granted','ad_user_data':'granted','ad_personalization':'granted','analytics_storage':'granted'});
try {
  if (window.localStorage.getItem('${GA_CONSENT_STORAGE_KEY}') === 'denied') {
    gtag('consent','update',{'ad_storage':'denied','ad_user_data':'denied','ad_personalization':'denied','analytics_storage':'denied'});
  }
} catch (e) { /* localStorage indisponível — mantém o default granted */ }
gtag('js', new Date());
gtag('config', '${measurementId}', { send_page_view: false });
`.trim();

  return (
    <>
      {/* Inline, no HTML inicial: consent default + reaplicação de opt-out
          ANTES do gtag.js carregar. Não usa next/script porque precisa rodar
          de forma síncrona na ordem do documento. O measurementId é validado
          pelo schema (regex G-XXXXXXXX), então é seguro interpolar. */}
      <script id="ga-bootstrap" dangerouslySetInnerHTML={{ __html: bootstrap }} />
      <Script
        id="ga-gtag-js"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </>
  );
}
