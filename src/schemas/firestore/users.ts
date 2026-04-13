import { z } from "zod";
import {
  nonEmptyStringSchema,
  timestampSchema,
  uidSchema,
} from "@/src/schemas/firestore/utils";

export const userProfileSchema = z.object({
  id: uidSchema,
  email: z.string().email(),
  firstName: nonEmptyStringSchema,
  lastName: nonEmptyStringSchema,
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  role: z.enum(["customer", "admin"]).default("customer"),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type UserProfile = z.infer<typeof userProfileSchema>;
