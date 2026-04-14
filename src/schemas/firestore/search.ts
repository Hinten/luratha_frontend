import { z } from "zod";
import { nonEmptyStringSchema } from "@/src/schemas/firestore/utils";

export const pipelineSearchRequestSchema = z.object({
  term: nonEmptyStringSchema,
  categorySlug: nonEmptyStringSchema.optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  tags: z.array(nonEmptyStringSchema).max(20).optional(),
  limit: z.number().int().min(1).max(100).default(24),
  offset: z.number().int().min(0).default(0),
});

export const vectorSearchRequestSchema = z.object({
  embedding: z.array(z.number()).min(8).max(4096),
  topK: z.number().int().min(1).max(100).default(20),
  minScore: z.number().min(0).max(1).default(0),
  categorySlug: nonEmptyStringSchema.optional(),
});

export type PipelineSearchRequest = z.infer<typeof pipelineSearchRequestSchema>;
export type VectorSearchRequest = z.infer<typeof vectorSearchRequestSchema>;
