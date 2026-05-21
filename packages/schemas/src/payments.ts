import { z } from "zod";

/**
 * Schema do formulário do **pagador** (Step 3 do checkout) — usado com
 * `react-hook-form` + `zodResolver` para validação inline por campo. É o
 * subconjunto comum a PIX / Cartão / Boleto: o que o MercadoPago precisa
 * pra atribuir um pagamento a um usuário fiscal.
 *
 * Não inclui dados do cartão (PAN/CVV/expiry) — esses são tokenizados pelo
 * cardForm SDK do MP (iframes) e nunca passam pelo nosso JS.
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
