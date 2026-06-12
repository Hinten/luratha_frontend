/**
 * Formata um CNPJ enquanto o usuário digita: mantém só letras/dígitos
 * (maiusculizando as letras), corta no 14º caractere e insere os pontos +
 * barra + hífen no formato `99.999.999/9999-99`. Aceita entrada parcial sem
 * inserir separadores prematuramente.
 *
 * Letras são aceitas nas 12 primeiras posições por causa do CNPJ
 * alfanumérico (IN RFB nº 2.229/2024, emissão a partir de jul/2026) — a
 * máscara não distingue posição; quem valida formato/DV é o schema.
 *
 * Exemplos:
 *   formatCnpj("1")                → "1"
 *   formatCnpj("12")               → "12"
 *   formatCnpj("123")              → "12.3"
 *   formatCnpj("12345")            → "12.345"
 *   formatCnpj("12345678")         → "12.345.678"
 *   formatCnpj("1234567890")       → "12.345.678/90"
 *   formatCnpj("123456780001")     → "12.345.678/0001"
 *   formatCnpj("12345678000195")   → "12.345.678/0001-95"
 *   formatCnpj("12abc34501de35")   → "12.ABC.345/01DE-35"
 *   formatCnpj("12.345.678/0001-95??") → "12.345.678/0001-95"
 */
export function formatCnpj(input: string): string {
  const chars = input
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 14);
  if (chars.length <= 2) return chars;
  if (chars.length <= 5) return `${chars.slice(0, 2)}.${chars.slice(2)}`;
  if (chars.length <= 8) {
    return `${chars.slice(0, 2)}.${chars.slice(2, 5)}.${chars.slice(5)}`;
  }
  if (chars.length <= 12) {
    return `${chars.slice(0, 2)}.${chars.slice(2, 5)}.${chars.slice(5, 8)}/${chars.slice(8)}`;
  }
  return `${chars.slice(0, 2)}.${chars.slice(2, 5)}.${chars.slice(5, 8)}/${chars.slice(8, 12)}-${chars.slice(12)}`;
}
