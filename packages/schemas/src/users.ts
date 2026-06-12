import { z } from "zod";
import { nonEmptyStringSchema, timestampSchema, uidSchema } from "@luratha/schemas/utils";

/**
 * Identidade fiscal do usuário — necessária para emissão de NF-e.
 *
 * - PF (Pessoa Física): CPF obrigatório; RG e data de nascimento opcionais.
 * - PJ (Pessoa Jurídica): CNPJ + razão social + Inscrição Estadual obrigatórios.
 *   IE aceita string numérica OU as palavras-chave "ISENTO" / "NAO_CONTRIBUINTE".
 *   Inscrição Municipal é opcional (necessária só para serviços/ISS).
 * - ESTRANGEIRO: documento + país emissor (ISO-3166-1 alpha-2).
 *
 * Os formatos aceitos são os "mascarados" (CPF: 999.999.999-99,
 * CNPJ: 99.999.999/9999-99 — as 12 primeiras posições aceitam letras
 * maiúsculas, cobrindo o CNPJ alfanumérico emitido a partir de jul/2026).
 * A normalização para apenas dígitos acontece na hora de gerar a NF-e —
 * assim o que está no banco bate com o que o usuário digitou.
 */
export const taxIdentitySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PF"),
    cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/),
    rg: z.string().trim().max(20).optional(),
    /** Data de nascimento ISO YYYY-MM-DD. Útil para alguns layouts de NF-e e validações de idade. */
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  z.object({
    type: z.literal("PJ"),
    cnpj: z.string().regex(/^[A-Z\d]{2}\.[A-Z\d]{3}\.[A-Z\d]{3}\/[A-Z\d]{4}-\d{2}$/),
    legalName: nonEmptyStringSchema.max(200),
    tradeName: z.string().trim().max(200).optional(),
    stateRegistration: z.union([
      z.literal("ISENTO"),
      z.literal("NAO_CONTRIBUINTE"),
      z
        .string()
        .trim()
        .regex(/^\d{2,14}$/),
    ]),
    municipalRegistration: z.string().trim().max(20).optional(),
  }),
  z.object({
    type: z.literal("ESTRANGEIRO"),
    documentId: nonEmptyStringSchema.max(50),
    /** País emissor do documento (ISO-3166-1 alpha-2, ex: "US", "PT"). */
    documentCountry: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/),
  }),
]);

export type TaxIdentity = z.infer<typeof taxIdentitySchema>;

export const userProfileSchema = z.object({
  id: uidSchema,
  email: z.email(),
  firstName: nonEmptyStringSchema,
  lastName: nonEmptyStringSchema,
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{7,14}$/)
    .optional(),
  role: z.enum(["customer", "admin"]).default("customer"),
  /**
   * Identidade fiscal. Opcional no signup, obrigatória no checkout.
   * O fluxo de checkout deve bloquear a finalização se ausente.
   */
  taxIdentity: taxIdentitySchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export function validateUserProfile(input: unknown): UserProfile {
  return userProfileSchema.parse(input);
}
