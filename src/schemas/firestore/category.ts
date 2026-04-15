import { z } from "zod";
import { nonEmptyStringSchema } from "@/src/schemas/firestore/utils";

export const CategorySchema = z.object({
  id: nonEmptyStringSchema,
  parentId: nonEmptyStringSchema.optional(),
  name: nonEmptyStringSchema,
  slug: nonEmptyStringSchema,
});

export type FirestoreCategory = z.infer<typeof CategorySchema>;

export function validateCategory(input: unknown): FirestoreCategory {
  return CategorySchema.parse(input);
}
