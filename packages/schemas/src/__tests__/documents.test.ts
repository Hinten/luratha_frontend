import { describe, expect, it } from "vitest";
import { isValidCnpj, isValidCpf } from "@luratha/schemas/documents";

describe("isValidCpf", () => {
  it("aceita CPFs com dígitos verificadores corretos", () => {
    expect(isValidCpf("12345678909")).toBe(true);
    expect(isValidCpf("11144477735")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejeita CPF com DV errado", () => {
    expect(isValidCpf("12345678901")).toBe(false);
    expect(isValidCpf("12345678900")).toBe(false);
  });

  it("rejeita sequências de dígito repetido (DV bateria, mas é inválido)", () => {
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("99999999999")).toBe(false);
  });

  it("rejeita formato errado: tamanho, máscara, letras", () => {
    expect(isValidCpf("1234567890")).toBe(false);
    expect(isValidCpf("123456789090")).toBe(false);
    expect(isValidCpf("123.456.789-09")).toBe(false);
    expect(isValidCpf("1234567890A")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("aceita CNPJs numéricos com DVs corretos", () => {
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11444777000161")).toBe(true);
    expect(isValidCnpj("12345678000195")).toBe(true);
  });

  it("aceita o CNPJ alfanumérico (exemplo oficial do SERPRO)", () => {
    expect(isValidCnpj("12ABC34501DE35")).toBe(true);
  });

  it("rejeita CNPJ com DV errado, numérico ou alfanumérico", () => {
    expect(isValidCnpj("12345678000190")).toBe(false);
    expect(isValidCnpj("11222333000180")).toBe(false);
    expect(isValidCnpj("12ABC34501DE99")).toBe(false);
  });

  it("rejeita sequências de caractere repetido", () => {
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
  });

  it("rejeita formato errado: tamanho, máscara, minúsculas, letras nos DVs", () => {
    expect(isValidCnpj("1122233300018")).toBe(false);
    expect(isValidCnpj("112223330001811")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(false);
    expect(isValidCnpj("12abc34501de35")).toBe(false);
    expect(isValidCnpj("12ABC34501DEAB")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
  });
});
