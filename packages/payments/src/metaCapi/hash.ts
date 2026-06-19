/**
 * Normalização + hashing SHA-256 dos dados pessoais enviados à Conversions API.
 *
 * O Meta exige que os campos de `user_data` (email, telefone, nome, external_id)
 * sejam normalizados e hasheados em SHA-256 (hex minúsculo) antes do envio —
 * a loja nunca manda PII em claro. Cada helper devolve `undefined` para entradas
 * vazias, para o chamador simplesmente omitir o campo.
 *
 * Regras de normalização (spec do Meta):
 * - email: trim + lowercase.
 * - telefone: apenas dígitos (mantém o código do país, remove `+`, espaços, etc.).
 * - nome: trim + lowercase.
 */

import { createHash } from "node:crypto";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashEmail(email: string): string | undefined {
  const normalized = email.trim().toLowerCase();
  return normalized ? sha256(normalized) : undefined;
}

export function hashPhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, "");
  return digits ? sha256(digits) : undefined;
}

export function hashName(name: string): string | undefined {
  const normalized = name.trim().toLowerCase();
  return normalized ? sha256(normalized) : undefined;
}

/**
 * `external_id` é um identificador estável do usuário (aqui, o UID do Firebase).
 * Não normalizamos o case — o UID é case-sensitive — apenas trim + hash.
 */
export function hashExternalId(id: string): string | undefined {
  const normalized = id.trim();
  return normalized ? sha256(normalized) : undefined;
}
