/**
 * Validadores de documentos fiscais brasileiros (CPF/CNPJ), com dígito
 * verificador (mod-11). Ambos esperam o valor SEM máscara (sem pontos,
 * barra ou hífen).
 *
 * O CNPJ cobre também o formato alfanumérico (IN RFB nº 2.229/2024, emissão
 * a partir de jul/2026): 12 caracteres `[A-Z0-9]` + 2 dígitos verificadores
 * numéricos. No cálculo, o valor de cada caractere é `charCode - 48`
 * (dígitos → 0-9, letras A-Z → 17-42), o que mantém o algoritmo
 * retrocompatível com CNPJs 100% numéricos.
 */

const CPF_REGEX = /^\d{11}$/;
const CNPJ_REGEX = /^[A-Z\d]{12}\d{2}$/;

function isRepeatedSequence(value: string): boolean {
  return value.split("").every((ch) => ch === value[0]);
}

function cpfCheckDigit(cpf: string, length: number): number {
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += Number(cpf[i]) * (length + 1 - i);
  }
  const mod = (sum * 10) % 11;
  return mod === 10 ? 0 : mod;
}

/** Valida um CPF (11 dígitos, sem máscara): formato + DVs + não-sequência. */
export function isValidCpf(cpf: string): boolean {
  if (!CPF_REGEX.test(cpf) || isRepeatedSequence(cpf)) return false;
  return cpfCheckDigit(cpf, 9) === Number(cpf[9]) && cpfCheckDigit(cpf, 10) === Number(cpf[10]);
}

function cnpjCheckDigit(cnpj: string, length: number): number {
  let weight = 2;
  let sum = 0;
  for (let i = length - 1; i >= 0; i--) {
    sum += (cnpj.charCodeAt(i) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

/**
 * Valida um CNPJ (14 caracteres, sem máscara, letras em MAIÚSCULA):
 * formato (numérico ou alfanumérico) + DVs + não-sequência.
 */
export function isValidCnpj(cnpj: string): boolean {
  if (!CNPJ_REGEX.test(cnpj) || isRepeatedSequence(cnpj)) return false;
  return (
    cnpjCheckDigit(cnpj, 12) === Number(cnpj[12]) && cnpjCheckDigit(cnpj, 13) === Number(cnpj[13])
  );
}
