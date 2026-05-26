import { PaymentProviderError } from "@/src/lib/payment/types";

/**
 * Configuração isolada do MercadoPago. Lê credenciais do ambiente:
 *   MERCADOPAGO_ACCESS_TOKEN    — obrigatório. Access token (sandbox: TEST-*, prod sem prefixo).
 *   MERCADOPAGO_WEBHOOK_SECRET  — obrigatório para validar webhooks.
 *
 * A integração usa a API de Orders (`POST /v1/orders`) via `fetch` raw — não há
 * dependência do SDK npm `mercadopago` aqui. O ambiente (sandbox/produção) é
 * determinado pelo próprio access token; não há flag separada.
 *
 * O webhook é configurado pelo painel MP ("Suas integrações" → "Webhooks") —
 * não há `notification_url` por requisição na API de Orders.
 */

export const MP_API_BASE_URL = "https://api.mercadopago.com";
export const MP_HTTP_TIMEOUT_MS = 10_000;

export interface MercadoPagoConfig {
  accessToken: string;
  timeoutMs: number;
}

export function resolveMercadoPagoConfig(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new PaymentProviderError(
      "MERCADOPAGO_ACCESS_TOKEN não configurado.",
      "config_missing",
    );
  }
  return { accessToken, timeoutMs: MP_HTTP_TIMEOUT_MS };
}

export function resolveWebhookSecret(): string {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new PaymentProviderError(
      "MERCADOPAGO_WEBHOOK_SECRET não configurado.",
      "config_missing",
    );
  }
  return secret;
}
