import { z } from "zod";
import { isValidCnpj, isValidCpf } from "@luratha/schemas/documents";
import { strictEmail } from "@luratha/schemas/email";

/**
 * Schema do formulário do **pagador** (Step 3 do checkout) — usado com
 * `react-hook-form` + `zodResolver` para validação inline por campo. Aplicável
 * a PIX e Boleto (Cartão é gerenciado pelo Card Payment Brick do MP, que tem
 * seu próprio form de payer e tokeniza o cartão na origem deles).
 *
 * O número do documento chega mascarado do form ("999.999.999-99" /
 * "99.999.999/9999-99") — o superRefine normaliza antes de validar. CNPJ
 * aceita o formato alfanumérico (12 chars [A-Z0-9] + 2 DVs numéricos).
 *
 * O campo `cardholderName` é legado e permanece optional — não é usado pelo
 * Brick mas é mantido pra compatibilidade do tipo.
 */
export const payerFormSchema = z
  .object({
    email: strictEmail("E-mail inválido."),
    firstName: z
      .string()
      .trim()
      .min(1, "Informe o primeiro nome.")
      .max(80, "Nome muito longo (máx. 80)."),
    lastName: z
      .string()
      .trim()
      .min(1, "Informe o sobrenome.")
      .max(80, "Sobrenome muito longo (máx. 80)."),
    identificationType: z.enum(["CPF", "CNPJ"], {
      message: "Selecione o tipo de documento.",
    }),
    identificationNumber: z.string().trim().min(1, "Informe o número do documento."),
    /** Só obrigatório quando method === "credit_card"; validação extra no PaymentStep. */
    cardholderName: z.string().trim().max(80).optional(),
  })
  .superRefine((data, ctx) => {
    const addIssue = (message: string) =>
      ctx.addIssue({ code: "custom", path: ["identificationNumber"], message });

    if (data.identificationType === "CPF") {
      const digits = data.identificationNumber.replace(/\D/g, "");
      if (digits.length !== 11) {
        addIssue("CPF deve ter 11 dígitos.");
      } else if (!isValidCpf(digits)) {
        addIssue("CPF inválido. Confira os dígitos digitados.");
      }
      return;
    }

    const chars = data.identificationNumber.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (chars.length !== 14) {
      addIssue("CNPJ deve ter 14 caracteres.");
    } else if (!isValidCnpj(chars)) {
      addIssue("CNPJ inválido. Confira os caracteres digitados.");
    }
  });

export type PayerFormInput = z.infer<typeof payerFormSchema>;
