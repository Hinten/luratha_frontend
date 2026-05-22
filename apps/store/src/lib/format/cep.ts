/**
 * Formata um CEP enquanto o usuário digita: mantém só dígitos, corta no 8º e
 * insere o hífen no formato `99999-999`. Aceita entrada parcial sem inserir o
 * hífen prematuramente.
 *
 * Exemplos:
 *   formatCep("1")        → "1"
 *   formatCep("12345")    → "12345"
 *   formatCep("123456")   → "12345-6"
 *   formatCep("12345678") → "12345-678"
 *   formatCep("12345-678abc") → "12345-678"
 */
export function formatCep(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
