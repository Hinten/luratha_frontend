import { z } from "zod";
import { colorHexSchema, nonEmptyStringSchema, timestampSchema } from "@luratha/schemas/utils";

export const photoSchema = z.object({
  id: nonEmptyStringSchema,
  storagePath: nonEmptyStringSchema,
  downloadUrl: z.url(),
  checksumSha256: z.string().trim().length(64),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: nonEmptyStringSchema,
  colorHex: colorHexSchema.optional(),
  tags: z.array(nonEmptyStringSchema).max(25).default([]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Photo = z.infer<typeof photoSchema>;
