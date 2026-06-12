import { describe, expect, it } from "vitest";
import { payerFormSchema } from "@luratha/schemas/payments";

const validBase = {
  email: "marina@example.com",
  firstName: "Marina",
  lastName: "Souza",
  identificationType: "CPF" as const,
  identificationNumber: "123.456.789-09",
};

function issueMessages(input: unknown): string[] {
  const result = payerFormSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("payerFormSchema", () => {
  it("aceita o payload válido de referência", () => {
    expect(payerFormSchema.safeParse(validBase).success).toBe(true);
  });

  describe("email", () => {
    it("rejeita email com múltiplos @ (issue #160)", () => {
      for (const email of ["a@b@c.com", "user@@dominio.com", '"a@b"@c.com']) {
        expect(issueMessages({ ...validBase, email })).toContain("E-mail inválido.");
      }
    });

    it("rejeita formatos quebrados e aceita email normal", () => {
      expect(issueMessages({ ...validBase, email: "not-an-email" })).toContain("E-mail inválido.");
      expect(payerFormSchema.safeParse({ ...validBase, email: "a@testuser.com" }).success).toBe(
        true,
      );
    });
  });

  describe("nomes", () => {
    it("rejeita nome/sobrenome acima de 80 caracteres", () => {
      const long = "x".repeat(81);
      expect(issueMessages({ ...validBase, firstName: long })).toContain(
        "Nome muito longo (máx. 80).",
      );
      expect(issueMessages({ ...validBase, lastName: long })).toContain(
        "Sobrenome muito longo (máx. 80).",
      );
    });
  });

  describe("CPF", () => {
    it("rejeita CPF com contagem errada de dígitos", () => {
      expect(issueMessages({ ...validBase, identificationNumber: "123" })).toContain(
        "CPF deve ter 11 dígitos.",
      );
    });

    it("rejeita CPF com DV inválido", () => {
      for (const cpf of ["111.111.111-11", "123.456.789-00"]) {
        expect(issueMessages({ ...validBase, identificationNumber: cpf })).toContain(
          "CPF inválido. Confira os dígitos digitados.",
        );
      }
    });

    it("rejeita CPF contendo letras (ex.: valor alfanumérico após trocar CNPJ→CPF)", () => {
      // 11 dígitos válidos + letra: sem o check explícito, o strip de
      // não-dígitos aprovaria no client um valor que o servidor rejeita.
      expect(issueMessages({ ...validBase, identificationNumber: "12345678909A" })).toContain(
        "CPF deve conter apenas dígitos.",
      );
    });

    it("aceita CPF válido com ou sem máscara", () => {
      for (const cpf of ["123.456.789-09", "12345678909"]) {
        expect(payerFormSchema.safeParse({ ...validBase, identificationNumber: cpf }).success).toBe(
          true,
        );
      }
    });
  });

  describe("CNPJ", () => {
    const cnpjBase = { ...validBase, identificationType: "CNPJ" as const };

    it("rejeita CNPJ com contagem errada de caracteres", () => {
      expect(issueMessages({ ...cnpjBase, identificationNumber: "11.222.333/0001" })).toContain(
        "CNPJ deve ter 14 caracteres.",
      );
    });

    it("rejeita CNPJ com DV inválido", () => {
      expect(issueMessages({ ...cnpjBase, identificationNumber: "12.345.678/0001-90" })).toContain(
        "CNPJ inválido. Confira os caracteres digitados.",
      );
    });

    it("aceita CNPJ numérico e alfanumérico, com ou sem máscara", () => {
      for (const cnpj of [
        "11.222.333/0001-81",
        "11222333000181",
        "12.ABC.345/01DE-35",
        "12abc34501de35",
      ]) {
        expect(payerFormSchema.safeParse({ ...cnpjBase, identificationNumber: cnpj }).success).toBe(
          true,
        );
      }
    });
  });
});
