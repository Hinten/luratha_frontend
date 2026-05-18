/**
 * Persistência client-side do último estimate de frete grátis.
 *
 * Exposto como um "external store" para `useSyncExternalStore`: a PDP e o
 * carrinho leem o mesmo valor sem `useEffect`/`setState` e sem mismatch de
 * hidratação. `saveShippingEstimate` dispara um evento que invalida o snapshot.
 */

const STORAGE_KEY = "luratha_shipping_estimate";
const ESTIMATE_EVENT = "luratha:shipping-estimate";

export interface StoredShippingEstimate {
  postalCode: string;
  freeShippingThreshold: number | null;
  referenceShippingCost: number | null;
  divisor: number;
  freeShippingEnabled: boolean;
  fetchedAt: string;
}

/**
 * Cache do snapshot. `useSyncExternalStore` exige que `getSnapshot` devolva a
 * MESMA referência enquanto o dado não muda — senão entra em loop de render.
 * Guardamos a string crua lida do localStorage e só reparseamos quando ela
 * difere da última leitura.
 */
let cachedRaw: string | null = null;
let cachedValue: StoredShippingEstimate | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    if (err instanceof DOMException) {
      // localStorage bloqueado (modo privado / política do navegador).
      return null;
    }
    throw err;
  }
}

function parseEstimate(raw: string): StoredShippingEstimate | null {
  try {
    const parsed = JSON.parse(raw) as StoredShippingEstimate;
    if (typeof parsed?.postalCode !== "string") return null;
    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Conteúdo corrompido — trata como ausente.
      return null;
    }
    throw err;
  }
}

/** Snapshot estável para `useSyncExternalStore` (lado cliente). */
export function getShippingEstimateSnapshot(): StoredShippingEstimate | null {
  if (typeof window === "undefined") return null;
  const raw = readRaw();
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = raw ? parseEstimate(raw) : null;
  return cachedValue;
}

/** Snapshot do servidor para `useSyncExternalStore` — sempre `null` (sem localStorage no SSR). */
export function getShippingEstimateServerSnapshot(): StoredShippingEstimate | null {
  return null;
}

/**
 * Inscrição para `useSyncExternalStore`. Notifica em duas situações:
 *  - `storage`: o estimate mudou em outra aba.
 *  - evento custom: mudou nesta mesma aba (`saveShippingEstimate`/`clearShippingEstimate`).
 */
export function subscribeShippingEstimate(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(ESTIMATE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(ESTIMATE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function saveShippingEstimate(estimate: StoredShippingEstimate): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estimate));
  } catch (err) {
    if (err instanceof DOMException) {
      // QuotaExceededError ou localStorage indisponível.
      return;
    }
    throw err;
  }
  window.dispatchEvent(new CustomEvent(ESTIMATE_EVENT));
}

export function clearShippingEstimate(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    if (err instanceof DOMException) {
      return;
    }
    throw err;
  }
  window.dispatchEvent(new CustomEvent(ESTIMATE_EVENT));
}
