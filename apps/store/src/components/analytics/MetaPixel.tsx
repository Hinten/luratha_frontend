import { Suspense } from "react";
import { GA_CONSENT_STORAGE_KEY } from "@/src/lib/analytics/gtag";
import MetaPixelPageViewTracker from "./MetaPixelPageViewTracker";

interface MetaPixelProps {
  /** ID numérico do Meta Pixel. Vazio = Pixel desligado. */
  pixelId: string;
}

/**
 * Injeta o Meta (Facebook) Pixel respeitando o opt-out compartilhado com o GA4.
 *
 * Ordem garantida pelo bootstrap inline (roda na ordem do documento, antes do
 * fbevents.js terminar de carregar — o snippet enfileira os comandos):
 * 1. Define o `fbq` e injeta o `fbevents.js` (snippet canônico do Meta).
 * 2. ANTES do `init`, reaplica `consent: revoke` se o visitante já recusou numa
 *    visita anterior (mesma chave `localStorage` do GA4) — o Pixel retém os
 *    eventos até um futuro `grant`.
 * 3. `init` do Pixel + `PageView` inicial. As navegações SPA seguintes são
 *    enviadas pelo `MetaPixelPageViewTracker` (que ignora o primeiro render para
 *    não contar a primeira visualização duas vezes).
 *
 * Renderiza `null` quando não há Pixel ID configurado.
 */
export default function MetaPixel({ pixelId }: MetaPixelProps) {
  if (!pixelId) return null;

  // Escapa o valor para um literal JS seguro antes de interpolar no script
  // inline. O `pixelId` vem do schema (regex de dígitos), mas escapamos por
  // defesa em profundidade — mesma postura do `Analytics.tsx`/`JsonLd.tsx`.
  const jsLiteral = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c");

  const bootstrap = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
try {
  if (window.localStorage.getItem(${jsLiteral(GA_CONSENT_STORAGE_KEY)}) === 'denied') {
    fbq('consent','revoke');
  }
} catch (e) { /* localStorage indisponível — mantém o consentimento padrão */ }
fbq('init', ${jsLiteral(pixelId)});
fbq('track', 'PageView');
`.trim();

  return (
    <>
      {/* Inline, no HTML inicial: carrega o fbevents.js, reaplica o opt-out e
          dispara o PageView inicial. Não usa next/script porque precisa rodar
          de forma síncrona na ordem do documento. Valores interpolados são
          escapados (jsLiteral / encodeURIComponent) por defesa em profundidade. */}
      <script id="meta-pixel-bootstrap" dangerouslySetInnerHTML={{ __html: bootstrap }} />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
        />
      </noscript>
      <Suspense fallback={null}>
        <MetaPixelPageViewTracker />
      </Suspense>
    </>
  );
}
