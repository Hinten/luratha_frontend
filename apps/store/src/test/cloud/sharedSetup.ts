import { randomUUID } from "node:crypto";
import { describe } from "vitest";

const cloudEnabled = process.env.RUN_CLOUD_TESTS === "true";
const hasSkipReason =
  process.env.CLOUD_TEST_SKIP_REASON && process.env.CLOUD_TEST_SKIP_REASON.length > 0;

export const describeCloud = cloudEnabled && !hasSkipReason ? describe : describe.skip;

/**
 * Gate para testes que batem no sandbox real do Melhor Envio. Independente do
 * Firebase — só exige `MELHOR_ENVIO_TOKEN`. Pula quando o token está ausente
 * (dev local sem credenciais) e roda na CI quando o secret está configurado.
 */
export const describeMelhorEnvio =
  process.env.MELHOR_ENVIO_TOKEN && process.env.MELHOR_ENVIO_TOKEN.trim().length > 0
    ? describe
    : describe.skip;

export function createCloudTestPrefix(): string {
  return `__test_${Date.now()}_${randomUUID().slice(0, 8)}`;
}
