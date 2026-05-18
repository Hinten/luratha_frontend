import { z } from "zod";
import {
  nonEmptyStringSchema,
  timestampSchema,
  uidSchema,
} from "@/src/schemas/firestore/utils";

export const reviewSchema = z.object({
  id: nonEmptyStringSchema,
  productId: nonEmptyStringSchema,
  orderId: nonEmptyStringSchema,
  userId: uidSchema,
  rating: z.number().int().min(1).max(5),
  title: nonEmptyStringSchema,
  comment: z.string().trim().min(10).max(1000),
  helpfulCount: z.number().int().min(0).default(0),
  verifiedPurchase: z.boolean().default(true),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Review = z.infer<typeof reviewSchema>;
