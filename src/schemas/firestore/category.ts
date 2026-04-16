import { z } from "zod";
import { nonEmptyStringSchema } from "@/src/schemas/firestore/utils";

type _Category = {
  id: string;
  parentId?: string;
  name: string;
  slug: string;
  children: _Category[];
};

export const CategorySchema: z.ZodType<_Category> = z.object({
  id: nonEmptyStringSchema,
  parentId: nonEmptyStringSchema.optional(),
  name: nonEmptyStringSchema,
  slug: nonEmptyStringSchema,
  children: z.array(z.lazy(() => CategorySchema)).default([]),
});

export type Category = z.infer<typeof CategorySchema>;

export function validateCategory(input: unknown): Category {
  return CategorySchema.parse(input);
}
