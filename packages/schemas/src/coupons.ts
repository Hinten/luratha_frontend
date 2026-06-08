import { z } from "zod";
import {
  nonEmptyStringSchema,
  nonNegativeMoneySchema,
  timestampSchema,
} from "@luratha/schemas/utils";

export const couponSchema = z
  .object({
    id: nonEmptyStringSchema,
    code: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .transform((value) => value.toUpperCase()),
    type: z.enum(["percentage", "fixed"]),
    amount: z.number().gt(0),
    maxDiscountAmount: z.number().gt(0).optional(),
    minimumOrderAmount: nonNegativeMoneySchema.default(0),
    startsAt: timestampSchema,
    expiresAt: timestampSchema,
    usageLimit: z.number().int().positive().optional(),
    usageCount: z.number().int().min(0).default(0),
    active: z.boolean().default(true),
  })
  .superRefine((coupon, ctx) => {
    if (coupon.type === "percentage" && coupon.amount > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "percentage coupon amount must be lower than or equal to 100",
      });
    }

    if (coupon.expiresAt <= coupon.startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "expiresAt must be greater than startsAt",
      });
    }
  });

export type Coupon = z.infer<typeof couponSchema>;

export function validateCoupon(input: unknown): Coupon {
  return couponSchema.parse(input);
}
