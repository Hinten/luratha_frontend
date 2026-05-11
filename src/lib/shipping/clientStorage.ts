/**
 * Persistência client-side do último estimate de frete grátis.
 *
 * Permite que a PDP e o carrinho compartilhem o threshold sem refetch a cada
 * navegação. A chave guarda o CEP digitado pelo usuário — se o usuário trocar
 * de CEP em qualquer página, sobrescreve aqui.
 */

const STORAGE_KEY = "luratha_shipping_estimate";

export interface StoredShippingEstimate {
  postalCode: string;
  freeShippingThreshold: number | null;
  referenceShippingCost: number | null;
  divisor: number;
  freeShippingEnabled: boolean;
  fetchedAt: string;
}

export function getStoredShippingEstimate(): StoredShippingEstimate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredShippingEstimate;
    if (typeof parsed?.postalCode !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveShippingEstimate(estimate: StoredShippingEstimate): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estimate));
    window.dispatchEvent(new CustomEvent("luratha:shipping-estimate", { detail: estimate }));
  } catch {
    /* ignore quota errors */
  }
}

export function clearShippingEstimate(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("luratha:shipping-estimate", { detail: null }));
  } catch {
    /* ignore */
  }
}
