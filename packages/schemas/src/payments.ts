import { z } from "zod";

/**
 * Schema do formulário do **pagador** (Step 3 do checkout) — usado com
 * `react-hook-form` + `zodResolver` para validação inline por campo. Aplicável
 * a PIX e Boleto (Cartão é gerenciado pelo Card Payment Brick do MP, que tem
 * seu próprio form de payer e tokeniza o cartão na origem deles).
 *
 * O campo `cardholderName` é legado e permanece optional — não é usado pelo
 * Brick mas é mantido pra compatibilidade do tipo.
 */
export const payerFormSchema = z
  .object({
    email: z.email("E-mail inválido."),
    firstName: z.string().trim().min(1, "Informe o primeiro nome."),
    lastName: z.string().trim().min(1, "Informe o sobrenome."),
    identificationType: z.enum(["CPF", "CNPJ"], {
      message: "Selecione o tipo de documento.",
    }),
    identificationNumber: z
      .string()
      .trim()
      .min(1, "Informe o número do documento."),
    /** Só obrigatório quando method === "credit_card"; validação extra no PaymentStep. */
    cardholderName: z.string().trim().max(80).optional(),
  })
  .superRefine((data, ctx) => {
    const digits = data.identificationNumber.replace(/\D/g, "");
    const expected = data.identificationType === "CPF" ? 11 : 14;
    if (digits.length !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["identificationNumber"],
        message:
          data.identificationType === "CPF"
            ? "CPF deve ter 11 dígitos."
            : "CNPJ deve ter 14 dígitos.",
      });
    }
  });

export type PayerFormInput = z.infer<typeof payerFormSchema>;
