/**
 * Formata um CPF enquanto o usuário digita: mantém só dígitos, corta no 11º
 * e insere os pontos + hífen no formato `999.999.999-99`. Aceita entrada
 * parcial sem inserir separadores prematuramente.
 *
 * Exemplos:
 *   formatCpf("1")             → "1"
 *   formatCpf("123")           → "123"
 *   formatCpf("1234")          → "123.4"
 *   formatCpf("1234567")       → "123.456.7"
 *   formatCpf("123456789")     → "123.456.789"
 *   formatCpf("1234567890")    → "123.456.789-0"
 *   formatCpf("12345678901")   → "123.456.789-01"
 *   formatCpf("123.456.789-01abc") → "123.456.789-01"
 */
export function formatCpf(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
