import { z } from "zod";
import { nonEmptyStringSchema } from "@luratha/schemas/utils";

export const CategorySchema = z.object({
  id: nonEmptyStringSchema,
  parentId: nonEmptyStringSchema.optional(),
  name: nonEmptyStringSchema,
  slug: nonEmptyStringSchema,
});

export type Category = z.infer<typeof CategorySchema>;

export function validateCategory(input: unknown): Category {
  return CategorySchema.parse(input);
}
