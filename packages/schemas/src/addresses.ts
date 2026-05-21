import { z } from "zod";
import { UFS } from "@luratha/schemas/constants";
import {
  nonEmptyStringSchema,
  timestampSchema,
} from "@luratha/schemas/utils";

/**
 * Endereço salvo do usuário, persistido como subcoleção em
 * `userProfiles/{uid}/addresses/{addressId}`.
 *
 * Os campos cobrem tudo que a NF-e (modelo 55/65) exige no destinatário:
 * logradouro, número, complemento, bairro, município, UF, CEP, país, e o
 * código IBGE do município (opcional aqui — pode ser resolvido pela API
 * dos Correios/IBGE no servidor antes da emissão).
 *
 * `country` é literal "BR" enquanto não houver entrega internacional. Se
 * for liberar exportação, transformar em string ISO-3166-1 alpha-2.
 */
export const addressSchema = z.object({
  id: nonEmptyStringSchema,

  /** Rótulo livre escolhido pelo usuário ("Casa", "Trabalho"). Opcional. */
  label: z.string().trim().max(50, "Apelido muito longo (máx. 50).").optional(),

  /** Nome de quem recebe — pode diferir do nome do usuário. */
  recipientName: z
    .string()
    .trim()
    .min(1, "Informe o nome do destinatário."),

  /** CEP no formato 99999-999. */
  postalCode: z
    .string()
    .regex(/^\d{5}-\d{3}$/, "CEP inválido. Use o formato 00000-000."),

  /** Logradouro (rua/avenida). */
  line1: z.string().trim().min(1, "Informe o logradouro."),

  /** Número do imóvel. Aceita "S/N" para imóveis sem numeração. */
  number: z
    .string()
    .trim()
    .min(1, "Informe o número (use S/N se não houver).")
    .max(20, "Número muito longo (máx. 20)."),

  /** Complemento (apto, bloco, sala). Opcional. */
  complement: z
    .string()
    .trim()
    .max(100, "Complemento muito longo (máx. 100).")
    .optional(),

  /** Ponto de referência (opcional). */
  reference: z
    .string()
    .trim()
    .max(200, "Referência muito longa (máx. 200).")
    .optional(),

  /** Bairro. */
  neighborhood: z.string().trim().min(1, "Informe o bairro."),

  /** Município. */
  city: z.string().trim().min(1, "Informe a cidade."),

  /** UF (sigla de 2 letras) — 26 estados + DF + EX (estrangeiro). */
  state: z.enum(UFS, { message: "Selecione um estado." }),

  /** Código IBGE do município (7 dígitos). Necessário para NF-e. Opcional aqui. */
  ibgeCode: z.string().regex(/^\d{7}$/).optional(),

  country: z.literal("BR"),

  /** Marca o endereço como padrão do usuário. Apenas um endereço deve ser default. */
  isDefault: z.boolean().default(false),

  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Address = z.infer<typeof addressSchema>;

export function validateAddress(input: unknown): Address {
  return addressSchema.parse(input);
}

/**
 * Schema para o input do AddressForm (sem campos server-controlled). Usado
 * com `zodResolver` no react-hook-form para validação inline por campo. Não
 * inclui `id`, `createdAt`, `updatedAt`, `country` (literal sempre "BR") nem
 * `ibgeCode` (resolvido server-side).
 *
 * O `isDefault` é re-declarado sem `.default(false)`: o form sempre fornece
 * um valor inicial (controlado pelo `useForm.defaultValues`), e manter o
 * `.default()` deixaria o **input type** do Zod como `isDefault?: boolean`,
 * que conflita com o **output type** `isDefault: boolean` esperado pelo
 * `zodResolver` do react-hook-form.
 */
export const addressFormSchema = addressSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    country: true,
    ibgeCode: true,
  })
  .extend({
    isDefault: z.boolean(),
  });

export type AddressFormInput = z.infer<typeof addressFormSchema>;

/**
 * Constrói o caminho Firestore completo de um endereço.
 * Útil para o campo `shippingAddressPath` em Order.
 */
export function buildAddressPath(userId: string, addressId: string): string {
  return `userProfiles/${userId}/addresses/${addressId}`;
}

/**
 * Regex que valida o formato `userProfiles/{uid}/addresses/{addressId}`.
 * Mantida frouxa o suficiente para aceitar qualquer uid/addressId não vazios
 * sem caracteres reservados pelo Firestore.
 */
export const ADDRESS_PATH_REGEX =
  /^userProfiles\/[A-Za-z0-9_-]{1,128}\/addresses\/[A-Za-z0-9_-]{1,128}$/;
