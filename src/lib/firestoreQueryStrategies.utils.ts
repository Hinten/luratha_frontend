export function normalizeLimit(value: number | undefined): number {
  return Math.min(Math.max(value ?? 24, 1), 100);
}

export function normalizeOffset(value: number | undefined): number {
  return Math.max(value ?? 0, 0);
}
