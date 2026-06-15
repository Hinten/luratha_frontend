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

  it("descarta caracteres que não são letras nem dígitos", () => {
    expect(formatCnpj("12.345.678/0001-90")).toBe("12.345.678/0001-90");
    expect(formatCnpj("12 345 678/0001--90??")).toBe("12.345.678/0001-90");
  });

  it("aceita CNPJ alfanumérico, maiusculizando as letras", () => {
    expect(formatCnpj("12abc34501de35")).toBe("12.ABC.345/01DE-35");
    expect(formatCnpj("12.ABC.345/01DE-35")).toBe("12.ABC.345/01DE-35");
    expect(formatCnpj("12AB")).toBe("12.AB");
  });

  it("trunca no 14º caractere (CNPJ tem 14 caracteres)", () => {
    expect(formatCnpj("12345678000190999")).toBe("12.345.678/0001-90");
    expect(formatCnpj("12ABC34501DE35XYZ")).toBe("12.ABC.345/01DE-35");
  });
});
