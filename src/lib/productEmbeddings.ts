import type { Product } from "@/src/schemas/firestore";
import type { EmbeddingService } from "@/src/lib/embeddingService";

/**
 * Builds the text used to generate the `vectorEmbedding` field.
 *
 * Simple embedding — title only.
 * Used for fast name-based similarity lookups.
 */
export function buildVectorEmbeddingText(product: Pick<Product, "title">): string {
  return product.title.trim();
}

/**
 * Builds the text used to generate the `searchEmbedding` field.
 *
 * Rich embedding — title + description + categoryId + variant sizes + variant colors.
 * Used for full semantic search (closest to what a customer would type).
 */
export function buildSearchEmbeddingText(
  product: Pick<Product, "title" | "description" | "categoryId" | "variants">,
): string {
  const parts: string[] = [product.title.trim(), product.description.trim()];

  if (product.categoryId) {
    parts.push(product.categoryId);
  }

  if (product.variants) {
    const variantParts = product.variants.flatMap((v) => [
      ...(v.size ?? []),
      ...(v.color ?? []),
    ]);
    if (variantParts.length > 0) {
      parts.push(variantParts.join(" "));
    }
  }

  return parts.filter(Boolean).join(" ");
}

/**
 * Generates `vectorEmbedding` and `searchEmbedding` for a product using
 * two separate embedding calls.
 *
 * Uses `Promise.allSettled` so an individual failure does not block the other.
 * Returns only the embeddings that succeeded — callers spread the result onto
 * the product, preserving existing values for any that failed.
 *
 * @example
 * ```ts
 * const embeddings = await generateProductEmbeddings(product, embeddingService);
 * product = { ...product, ...embeddings };
 * ```
 */
export async function generateProductEmbeddings(
  product: Pick<Product, "title" | "description" | "categoryId" | "variants">,
  embeddingService: EmbeddingService,
): Promise<{ vectorEmbedding?: number[]; searchEmbedding?: number[] }> {
  const [vectorResult, searchResult] = await Promise.allSettled([
    embeddingService.embed(buildVectorEmbeddingText(product)),
    embeddingService.embed(buildSearchEmbeddingText(product)),
  ]);

  if (vectorResult.status === "rejected") {
    const reason =
      vectorResult.reason instanceof Error
        ? vectorResult.reason.message
        : vectorResult.reason;
    console.warn("[generateProductEmbeddings] vectorEmbedding generation failed:", reason);
  }

  if (searchResult.status === "rejected") {
    const reason =
      searchResult.reason instanceof Error
        ? searchResult.reason.message
        : searchResult.reason;
    console.warn("[generateProductEmbeddings] searchEmbedding generation failed:", reason);
  }

  return {
    ...(vectorResult.status === "fulfilled"
      ? { vectorEmbedding: vectorResult.value }
      : {}),
    ...(searchResult.status === "fulfilled"
      ? { searchEmbedding: searchResult.value }
      : {}),
  };
}
