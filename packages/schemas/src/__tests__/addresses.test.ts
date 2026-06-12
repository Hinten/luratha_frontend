import { describe, expect, it } from "vitest";
import { addressFormSchema } from "@luratha/schemas/addresses";

const validBase = {
  recipientName: "Marina Souza",
  postalCode: "01310-100",
  line1: "Avenida Paulista",
  number: "1000",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  state: "SP" as const,
  isDefault: false,
};

function issueMessages(input: unknown): string[] {
  const result = addressFormSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("addressFormSchema", () => {
  it("aceita o endereço válido de referência", () => {
    expect(addressFormSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejeita campos de texto acima do limite", () => {
    expect(issueMessages({ ...validBase, recipientName: "x".repeat(121) })).toContain(
      "Nome do destinatário muito longo (máx. 120).",
    );
    expect(issueMessages({ ...validBase, line1: "x".repeat(121) })).toContain(
      "Logradouro muito longo (máx. 120).",
    );
    expect(issueMessages({ ...validBase, neighborhood: "x".repeat(81) })).toContain(
      "Bairro muito longo (máx. 80).",
    );
    expect(issueMessages({ ...validBase, city: "x".repeat(81) })).toContain(
      "Cidade muito longa (máx. 80).",
    );
  });

  it("aceita valores no limite exato", () => {
    const atLimit = {
      ...validBase,
      recipientName: "x".repeat(120),
      line1: "x".repeat(120),
      neighborhood: "x".repeat(80),
      city: "x".repeat(80),
    };
    expect(addressFormSchema.safeParse(atLimit).success).toBe(true);
  });
});
