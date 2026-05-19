import { z } from "zod";
import { nonNegativeMoneySchema, timestampSchema } from "@luratha/schemas/utils";

/**
 * Configuração global do e-commerce — documento único em `settings/global`.
 *
 * Centraliza decisões operacionais que o dono precisa ajustar sem deploy:
 * provider de frete, CEP de origem, divisor da fórmula de frete grátis, peso
 * de fallback para produtos sem `dimensions.weightKg`, etc.
 *
 * O token do provider de frete continua em variável de ambiente
 * (`MELHOR_ENVIO_TOKEN`) — nunca em Firestore.
 */

const postalCodeSchema = z.string().regex(/^\d{5}-?\d{3}$/);

export const SHIPPING_PROVIDER_IDS = ["melhor-envio", "fixed-rate"] as const;
export const shippingProviderIdSchema = z.enum(SHIPPING_PROVIDER_IDS);

export const shippingServiceSchema = z.object({
  /** ID interno do serviço dentro do provider (ex: "1" PAC no Melhor Envio). */
  code: z.string().trim().min(1).max(40),
  /** Nome amigável exibido ao cliente. */
  label: z.string().trim().min(1).max(60),
  /** Se false, o serviço é ignorado nas respostas mesmo se o provider devolver. */
  enabled: z.boolean().default(true),
});

export const freeShippingConfigSchema = z.object({
  /**
   * Divisor da fórmula `threshold = shippingCost1kg / divisor`.
   * Default 0.14 → para frete de R$10 (1kg), threshold = R$71,43.
   * Aumentar o divisor abaixa o threshold (mais clientes ganham frete grátis).
   */
  divisor: z.number().gt(0).max(1).default(0.14),
  /** Threshold mínimo absoluto. Cobre regiões com frete muito barato. */
  minThreshold: nonNegativeMoneySchema.default(0),
  /**
   * Teto absoluto do threshold. Acima disso, oferta de frete grátis fica
   * desligada (frete tão caro que não vale a pena absorver).
   * `null` significa sem teto.
   */
  maxThreshold: nonNegativeMoneySchema.nullable().default(null),
  /** Permite desativar a regra sem perder os valores configurados. */
  enabled: z.boolean().default(true),
});

export const fixedRateEntrySchema = z.object({
  /** UF do destino (sigla de 2 letras maiúsculas). */
  state: z.string().trim().length(2).regex(/^[A-Z]{2}$/),
  /** Preço base do serviço (até `weightLimitKg`). */
  price: nonNegativeMoneySchema,
  /** Prazo estimado em dias úteis. */
  estimatedDays: z.number().int().min(1).max(60),
  /** Limite de peso para esse preço. Acima disso, soma `additionalKgPrice` por kg extra. */
  weightLimitKg: z.number().positive().default(1),
  additionalKgPrice: nonNegativeMoneySchema.default(0),
});

export const fixedRateConfigSchema = z.object({
  carrier: z.string().trim().min(1).max(40).default("Loja"),
  service: z.string().trim().min(1).max(40).default("Padrão"),
  /** Tabela por UF. Se faltar a UF, usa `defaultEntry`. */
  entries: z.array(fixedRateEntrySchema).default([]),
  defaultEntry: fixedRateEntrySchema.nullable().default(null),
  /**
   * Liga/desliga o uso do fixed-rate como fallback automático quando o
   * provider primário falha (`provider_unavailable`/`config_missing`).
   * Não afeta o uso do fixed-rate como provider primário — isso é controlado
   * por `providerId`. Quando `false` (padrão), uma falha do provider primário
   * bloqueia o cálculo de frete (rota retorna 502) em vez de cair na tabela
   * fixa — postura segura, evita vender frete que pode dar prejuízo.
   */
  enabledAsFallback: z.boolean().default(false),
});

export const shippingSettingsSchema = z.object({
  /** Provider ativo. Mudar aqui troca toda a estratégia de cálculo. */
  providerId: shippingProviderIdSchema.default("melhor-envio"),
  /** CEP de origem (de onde a loja despacha). Aceita com ou sem hífen. */
  originPostalCode: postalCodeSchema,
  /** Serviços habilitados (filtro pós-resposta do provider). */
  enabledServices: z.array(shippingServiceSchema).default([]),
  /** Peso usado quando o produto não tem `dimensions.weightKg`. */
  fallbackProductWeightKg: z.number().positive().default(0.3),
  /** Dimensões usadas como fallback quando `dimensions` é null. */
  fallbackProductDimensionsCm: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .default({ length: 20, width: 15, height: 5 }),
  /** TTL do cache em memória do servidor para cotações. */
  cacheTtlSeconds: z.number().int().min(0).max(86400).default(3600),
  freeShipping: freeShippingConfigSchema.default(() =>
    freeShippingConfigSchema.parse({}),
  ),
  /** Configuração do fallback `fixed-rate`. Usado quando providerId === "fixed-rate"
   *  ou quando o provider externo falhar (degradação graceful). */
  fixedRate: fixedRateConfigSchema.default(() => fixedRateConfigSchema.parse({})),
});

export const siteSettingsSchema = z.object({
  id: z.literal("global"),
  shipping: shippingSettingsSchema,
  updatedAt: timestampSchema,
});

export type ShippingProviderId = z.infer<typeof shippingProviderIdSchema>;
export type ShippingServiceConfig = z.infer<typeof shippingServiceSchema>;
export type FreeShippingConfig = z.infer<typeof freeShippingConfigSchema>;
export type FixedRateEntry = z.infer<typeof fixedRateEntrySchema>;
export type FixedRateConfig = z.infer<typeof fixedRateConfigSchema>;
export type ShippingSettings = z.infer<typeof shippingSettingsSchema>;
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export function validateSiteSettings(input: unknown): SiteSettings {
  return siteSettingsSchema.parse(input);
}

/**
 * Default usado quando o documento `settings/global` ainda não existe ou
 * quando o provider precisa de um fallback em tempo de execução.
 *
 * Mantém valores razoáveis para o MVP, todos sobrepostos por Firestore quando
 * o dono criar o documento.
 */
export function getDefaultSiteSettings(now: string = new Date().toISOString()): SiteSettings {
  return siteSettingsSchema.parse({
    id: "global",
    shipping: {
      providerId: "melhor-envio",
      originPostalCode: "01310-100",
      enabledServices: [
        { code: "1", label: "PAC", enabled: true },
        { code: "2", label: "SEDEX", enabled: true },
      ],
      fallbackProductWeightKg: 0.3,
      cacheTtlSeconds: 3600,
      freeShipping: {
        divisor: 0.14,
        minThreshold: 0,
        maxThreshold: null,
        enabled: true,
      },
      fixedRate: {
        carrier: "Loja",
        service: "Padrão",
        entries: [],
        defaultEntry: {
          state: "SP",
          price: 25,
          estimatedDays: 7,
          weightLimitKg: 1,
          additionalKgPrice: 8,
        },
        enabledAsFallback: false,
      },
    },
    updatedAt: now,
  });
}

/** Normaliza um CEP para `99999-999`. Aceita entrada com ou sem hífen. */
export function normalizePostalCode(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) {
    throw new Error(`CEP inválido: "${value}" — esperado 8 dígitos.`);
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
