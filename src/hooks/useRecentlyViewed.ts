const STORAGE_KEY = "luratha_viewed_products";
const TTL_MS = 24 * 60 * 60 * 1000;

type ViewedMap = Record<string, number>;

function getViewedMap(): ViewedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ViewedMap) : {};
  } catch {
    return {};
  }
}

export function markProductViewed(slug: string): void {
  const map = getViewedMap();
  map[slug] = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable or quota exceeded
  }
}

export function wasProductViewedRecently(slug: string): boolean {
  const map = getViewedMap();
  const timestamp = map[slug];
  if (!timestamp) return false;
  return Date.now() - timestamp < TTL_MS;
}
