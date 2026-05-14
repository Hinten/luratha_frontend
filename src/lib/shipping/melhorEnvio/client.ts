import { ShippingProviderError } from "@/src/lib/shipping/types";

/**
 * Cliente HTTP isolado do Melhor Envio. Mantém auth, base URL e tratamento de
 * erro genérico em um lugar só — adapters chamam `melhorEnvioFetch(path, init)`.
 *
 * Configuração via env:
 *   MELHOR_ENVIO_TOKEN          — obrigatório. Token Bearer (sandbox ou prod).
 *   MELHOR_ENVIO_ENV            — "sandbox" (default) ou "production".
 *   MELHOR_ENVIO_USER_AGENT     — opcional. Header User-Agent exigido pela API.
 */

const BASE_URLS = {
  sandbox: "https://sandbox.melhorenvio.com.br",
  production: "https://www.melhorenvio.com.br",
} as const;

type MelhorEnvioEnv = keyof typeof BASE_URLS;

interface MelhorEnvioConfig {
  baseUrl: string;
  token: string;
  userAgent: string;
}

function resolveConfig(): MelhorEnvioConfig {
  const token = process.env.MELHOR_ENVIO_TOKEN?.trim();
  if (!token) {
    throw new ShippingProviderError(
      "MELHOR_ENVIO_TOKEN não configurado.",
      "melhor-envio",
      "config_missing",
    );
  }
  const envName = (process.env.MELHOR_ENVIO_ENV ?? "sandbox").toLowerCase() as MelhorEnvioEnv;
  const baseUrl = BASE_URLS[envName] ?? BASE_URLS.sandbox;
  const userAgent =
    process.env.MELHOR_ENVIO_USER_AGENT?.trim() || "Luratha (contato@luratha.com.br)";
  return { baseUrl, token, userAgent };
}

export async function melhorEnvioFetch<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { baseUrl, token, userAgent } = resolveConfig();
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 10_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": userAgent,
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ShippingProviderError(
        `Timeout chamando Melhor Envio (${timeoutMs}ms).`,
        "melhor-envio",
        "provider_unavailable",
        error,
      );
    }
    throw new ShippingProviderError(
      `Falha de rede chamando Melhor Envio.`,
      "melhor-envio",
      "provider_unavailable",
      error,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let bodyText = "";
    try {
      bodyText = await response.text();
    } catch (err) {
      // response.text() falha com TypeError quando o body já foi consumido ou
      // está bloqueado, e DOMException em AbortError. Outros erros propagam.
      if (!(err instanceof TypeError) && !(err instanceof DOMException)) {
        throw err;
      }
    }
    throw new ShippingProviderError(
      `Melhor Envio retornou HTTP ${response.status}: ${bodyText.slice(0, 200)}`,
      "melhor-envio",
      response.status >= 500 ? "provider_unavailable" : "invalid_input",
    );
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new ShippingProviderError(
      "Resposta do Melhor Envio não é JSON válido.",
      "melhor-envio",
      "provider_unavailable",
      error,
    );
  }
}
