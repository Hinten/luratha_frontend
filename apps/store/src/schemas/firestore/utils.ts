import { z } from "zod";

export const nonEmptyStringSchema = z.string().trim().min(1);

export const timestampSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/,
    "Invalid ISO-8601 datetime",
  );

export const moneySchema = z.number().gt(0);
export const nonNegativeMoneySchema = z.number().min(0);
export const quantitySchema = z.number().int().gt(0);
export const skuSchema = z.string().trim().regex(/^[A-Z0-9_-]{6,64}$/);
export const uidSchema = z.string().trim().min(6).max(128);
export const colorHexSchema = z.string().regex(/^#([A-Fa-f0-9]{6})$/);

export function toCents(value: number): number {
  return Math.round(value * 100);
}
