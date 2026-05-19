import type { ShippingQuote } from "@/src/lib/shipping/types";

type Entry = { value: ShippingQuote[]; expiresAt: number };

const store = new Map<string, Entry>();
const MAX_ENTRIES = 500;

export function getCachedQuotes(key: string): ShippingQuote[] | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedQuotes(key: string, value: ShippingQuote[], ttlSeconds: number): void {
  if (ttlSeconds <= 0) return;
  if (store.size >= MAX_ENTRIES) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function clearShippingCache(): void {
  store.clear();
}

export function buildCacheKey(parts: Record<string, unknown>): string {
  return Object.keys(parts)
    .sort()
    .map((k) => `${k}=${JSON.stringify(parts[k])}`)
    .join("|");
}
