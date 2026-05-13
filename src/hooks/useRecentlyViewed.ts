const STORAGE_KEY = "luratha_viewed_products";
const TTL_MS = 24 * 60 * 60 * 1000;

type ViewedMap = Record<string, number>;

function getViewedMap(): ViewedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ViewedMap) : {};
  } catch (err) {
    // Tolerate the two storage failure modes:
    //   - SyntaxError: stored payload isn't valid JSON (legacy / manual edit)
    //   - DOMException: localStorage blocked (private mode, disabled cookies)
    if (err instanceof SyntaxError || err instanceof DOMException) {
      return {};
    }
    throw err;
  }
}

export function markProductViewed(slug: string): void {
  const map = getViewedMap();
  map[slug] = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    if (err instanceof DOMException) {
      // QuotaExceededError / SecurityError — best-effort write; skip silently.
      return;
    }
    throw err;
  }
}

export function wasProductViewedRecently(slug: string): boolean {
  const map = getViewedMap();
  const timestamp = map[slug];
  if (!timestamp) return false;
  return Date.now() - timestamp < TTL_MS;
}
