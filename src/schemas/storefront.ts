import { z } from "zod";
import { nonEmptyStringSchema } from "@/src/schemas/firestore/utils";

const installmentsSchema = z.object({
  count: z.number().int().positive(),
  value: z.number().positive(),
});

export const productSchema = z.object({
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  slug: nonEmptyStringSchema.optional(),
  categorySlug: nonEmptyStringSchema.optional(),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative().optional(),
  imageUrl: z.string().url(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  installments: installmentsSchema.optional(),
});

export const categorySchema = z.object({
  label: nonEmptyStringSchema,
  href: nonEmptyStringSchema,
  imageUrl: z.string().url(),
});

export const reviewSchema = z.object({
  id: nonEmptyStringSchema,
  author: nonEmptyStringSchema,
  rating: z.number().int().min(1).max(5),
  comment: nonEmptyStringSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const productDetailSchema = productSchema.extend({
  description: nonEmptyStringSchema,
  images: z.array(z.string().url()).min(1),
  sizes: z.array(nonEmptyStringSchema).min(1),
  categorySlug: nonEmptyStringSchema,
  reviews: z.array(reviewSchema).optional(),
  highlights: z.array(nonEmptyStringSchema).optional(),
});

export type Product = z.infer<typeof productSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Review = z.infer<typeof reviewSchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;
