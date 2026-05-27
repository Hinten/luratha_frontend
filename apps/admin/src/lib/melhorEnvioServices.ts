import "server-only";
import { logger } from "@luratha/core/logging/logger";

/**
 * Busca o catálogo de serviços do Melhor Envio
 * (`GET /api/v2/me/shipment/services`) para que o admin escolha quais serviços
 * habilitar marcando uma lista, em vez de digitar códigos à mão.
 *
 * Retorna `null` quando o token não está configurado ou a chamada falha — o
 * formulário de configurações cai no editor manual nesse caso. O token
 * (`MELHOR_ENVIO_TOKEN`) é lido aqui, somente no servidor, e nunca chega ao
 * bundle do client.
 *
 * O token precisa do escopo `shipping-services` (ver docs/melhor-envio-setup.md);
 * sem o escopo a API responde 4xx e a função devolve `null`.
 *
 * Nota: o cliente HTTP completo do Melhor Envio vive em
 * `apps/store/src/lib/shipping/melhorEnvio/` e não é um pacote compartilhado.
 * A resolução de base URL/auth é replicada aqui de forma mínima e contida; um
 * futuro pacote `@luratha/shipping` unificaria as duas cópias.
 */

const BASE_URLS = {
  sandbox: "https://sandbox.melhorenvio.com.br",
  production: "https://www.melhorenvio.com.br",
} as const;

export interface MelhorEnvioServiceOption {
  /** ID do serviço no Melhor Envio — vira `code` em `enabledServices`. */
  code: string;
  /** Nome do serviço (ex.: "PAC", "SEDEX"). */
  label: string;
  /** Transportadora, quando informada pela API. */
  company: string | null;
}

interface RawService {
  id?: number | string;
  name?: string;
  company?: { name?: string } | null;
}

export async function fetchMelhorEnvioServices(): Promise<
  MelhorEnvioServiceOption[] | null
> {
  const token = process.env.MELHOR_ENVIO_TOKEN?.trim();
  if (!token) return null;

  const envName = (process.env.MELHOR_ENVIO_ENV ?? "sandbox").toLowerCase();
  const baseUrl =
    envName === "production" ? BASE_URLS.production : BASE_URLS.sandbox;
  const userAgent =
    process.env.MELHOR_ENVIO_USER_AGENT?.trim() ||
    "Luratha (contato@luratha.com.br)";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/v2/me/shipment/services`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": userAgent,
      },
    });
  } catch (err) {
    if (err instanceof DOMException || err instanceof TypeError) {
      // Timeout (AbortError) ou falha de rede — cai no editor manual.
      logger.warn("[melhorEnvioServices] chamada falhou", { message: err.message });
      return null;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    console.warn(
      `[melhorEnvioServices] HTTP ${response.status} — usando editor manual.`,
    );
    return null;
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Resposta não-JSON — cai no editor manual.
      console.warn("[melhorEnvioServices] resposta não-JSON.");
      return null;
    }
    throw err;
  }

  if (!Array.isArray(raw)) return null;

  return (raw as RawService[])
    .filter(
      (service): service is RawService & { id: number | string; name: string } =>
        service.id != null && typeof service.name === "string",
    )
    .map((service) => ({
      code: String(service.id),
      label: service.name,
      company: service.company?.name ?? null,
    }));
}
