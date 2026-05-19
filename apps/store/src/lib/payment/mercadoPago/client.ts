import { MercadoPagoConfig } from "mercadopago";
import { PaymentProviderError } from "@/src/lib/payment/types";

/**
 * Configuração isolada do MercadoPago. Lê credenciais do ambiente (ver
 * docs/mercadopago-setup.md):
 *   MERCADOPAGO_ACCESS_TOKEN    — obrigatório. Access token (sandbox ou prod).
 *   MERCADOPAGO_WEBHOOK_SECRET  — obrigatório para validar webhooks.
 *   MERCADOPAGO_WEBHOOK_URL     — opcional. URL pública do receiver de webhook;
 *                                 se ausente, usa a configurada no painel MP.
 *
 * O ambiente (sandbox/produção) é determinado pelo próprio access token —
 * tokens de teste começam com `TEST-`; não há flag separada.
 */

const CLIENT_TIMEOUT_MS = 10_000;

export function resolveMercadoPagoConfig(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new PaymentProviderError(
      "MERCADOPAGO_ACCESS_TOKEN não configurado.",
      "config_missing",
    );
  }
  return new MercadoPagoConfig({
    accessToken,
    options: { timeout: CLIENT_TIMEOUT_MS },
  });
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

/** URL pública do webhook, quando configurada via env. */
export function resolveWebhookUrl(): string | undefined {
  return process.env.MERCADOPAGO_WEBHOOK_URL?.trim() || undefined;
}
