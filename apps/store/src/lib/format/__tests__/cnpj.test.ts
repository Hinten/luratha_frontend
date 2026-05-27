import { describe, expect, it } from "vitest";
import { formatCnpj } from "@/src/lib/format/cnpj";

describe("formatCnpj", () => {
  it("retorna string vazia quando input é vazio", () => {
    expect(formatCnpj("")).toBe("");
  });

  it("não insere separadores prematuramente em entrada parcial", () => {
    expect(formatCnpj("1")).toBe("1");
    expect(formatCnpj("12")).toBe("12");
  });

  it("insere o primeiro ponto a partir do 3º dígito", () => {
    expect(formatCnpj("123")).toBe("12.3");
    expect(formatCnpj("12345")).toBe("12.345");
  });

  it("insere o segundo ponto a partir do 6º dígito", () => {
    expect(formatCnpj("123456")).toBe("12.345.6");
    expect(formatCnpj("12345678")).toBe("12.345.678");
  });

  it("insere a barra a partir do 9º dígito", () => {
    expect(formatCnpj("123456789")).toBe("12.345.678/9");
    expect(formatCnpj("123456780001")).toBe("12.345.678/0001");
  });

  it("insere o hífen a partir do 13º dígito", () => {
    expect(formatCnpj("1234567800019")).toBe("12.345.678/0001-9");
    expect(formatCnpj("12345678000190")).toBe("12.345.678/0001-90");
  });

  it("descarta caracteres não-numéricos do input", () => {
    expect(formatCnpj("12.345.678/0001-90")).toBe("12.345.678/0001-90");
    expect(formatCnpj("abc12def345gh678ij0001kl90")).toBe("12.345.678/0001-90");
  });

  it("trunca no 14º dígito (CNPJ tem 14 dígitos)", () => {
    expect(formatCnpj("12345678000190999")).toBe("12.345.678/0001-90");
  });
});
