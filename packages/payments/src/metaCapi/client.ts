/**
 * HTTP client + configuração da Meta Conversions API (CAPI).
 *
 * Espelha o estilo do adapter MercadoPago (`mercadoPago/client.ts` +
 * `mpFetch`): resolução de config a partir de env, `fetch` cru com
 * `AbortController`/timeout e uma classe de erro própria. A CAPI é **opcional** —
 * sem `META_CAPI_ACCESS_TOKEN`, `resolveMetaCapiConfig` devolve `null` e o envio
 * server-side vira no-op (o Pixel no navegador continua medindo normalmente).
 */

const GRAPH_API_BASE = "https://graph.facebook.com";
const DEFAULT_GRAPH_API_VERSION = "v21.0";
/** Timeout curto: o webhook do MP aguarda este POST antes de responder 200. */
const CAPI_HTTP_TIMEOUT_MS = 8_000;

export type MetaCapiErrorCode = "config_missing" | "provider_unavailable" | "unknown";

/**
 * Erro da integração CAPI. Classe própria (não `Error` genérico) para que a
 * orquestração possa engolir falhas de envio com `instanceof MetaCapiError` sem
 * mascarar bugs de programação — analytics nunca deve quebrar o webhook.
 */
export class MetaCapiError extends Error {
  readonly code: MetaCapiErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: MetaCapiErrorCode, cause?: unknown) {
    super(message);
    this.name = "MetaCapiError";
    this.code = code;
    this.cause = cause;
  }
}

export interface MetaCapiConfig {
  accessToken: string;
  /** Versão da Graph API (ex.: "v21.0"). Sobreponível por `META_GRAPH_API_VERSION`. */
  apiVersion: string;
  /** Código de teste do Events Manager (modo "Test Events"). Opcional. */
  testEventCode?: string;
  timeoutMs: number;
}

/**
 * Resolve a config da CAPI a partir do ambiente. Devolve `null` (não lança)
 * quando `META_CAPI_ACCESS_TOKEN` está ausente — a CAPI é opcional.
 */
export function resolveMetaCapiConfig(): MetaCapiConfig | null {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!accessToken) return null;
  return {
    accessToken,
    apiVersion: process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION,
    testEventCode: process.env.META_CAPI_TEST_EVENT_CODE?.trim() || undefined,
    timeoutMs: CAPI_HTTP_TIMEOUT_MS,
  };
}

/** Monta a URL do endpoint `/{version}/{pixelId}/events`. */
export function buildEventsUrl(apiVersion: string, pixelId: string): string {
  return `${GRAPH_API_BASE}/${apiVersion}/${encodeURIComponent(pixelId)}/events`;
}

/**
 * POST cru para a Graph API com timeout. Lança `MetaCapiError` em timeout, falha
 * de rede ou resposta não-2xx. Mantém a resposta parseada para diagnóstico.
 */
export async function capiFetch(
  url: string,
  payload: Record<string, unknown>,
  config: MetaCapiConfig,
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new MetaCapiError(
          "Timeout ao chamar a Conversions API.",
          "provider_unavailable",
          err,
        );
      }
      if (err instanceof TypeError) {
        // `fetch` lança TypeError em falha de rede (DNS, conexão recusada, …).
        throw new MetaCapiError(
          "Falha de rede ao chamar a Conversions API.",
          "provider_unavailable",
          err,
        );
      }
      throw err;
    }

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        if (!(err instanceof SyntaxError)) throw err;
        // Resposta sem JSON (raro — proxy/erro de borda). Preserva um trecho.
        parsed = { message: text.slice(0, 240) };
      }
    }

    if (!response.ok) {
      throw new MetaCapiError(
        `Conversions API retornou ${response.status}.`,
        "provider_unavailable",
        parsed,
      );
    }

    return parsed;
  } finally {
    clearTimeout(timer);
  }
}
