/**
 * Formata um CNPJ enquanto o usuário digita: mantém só dígitos, corta no
 * 14º e insere os pontos + barra + hífen no formato `99.999.999/9999-99`.
 * Aceita entrada parcial sem inserir separadores prematuramente.
 *
 * Exemplos:
 *   formatCnpj("1")                → "1"
 *   formatCnpj("12")               → "12"
 *   formatCnpj("123")              → "12.3"
 *   formatCnpj("12345")            → "12.345"
 *   formatCnpj("12345678")         → "12.345.678"
 *   formatCnpj("1234567890")       → "12.345.678/90"
 *   formatCnpj("123456780001")     → "12.345.678/0001"
 *   formatCnpj("12345678000190")   → "12.345.678/0001-90"
 *   formatCnpj("12.345.678/0001-90abc") → "12.345.678/0001-90"
 */
export function formatCnpj(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}
