import { z } from "zod";
import { nonEmptyStringSchema } from "@/src/schemas/firestore/utils";

export const CategorySchema = z.object({
  id: nonEmptyStringSchema,
  parentId: nonEmptyStringSchema.optional(),
  name: nonEmptyStringSchema,
  slug: nonEmptyStringSchema,
});
