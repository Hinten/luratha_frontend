import "server-only";
import { FirebaseError } from "firebase/app";
import { Timestamp } from "firebase/firestore";
import { and, execute, field } from "firebase/firestore/pipelines";
import { searchDb } from "@luratha/firestore/firebaseSearchDb";
import { firestoreCollections } from "@luratha/schemas";
import { logger } from "@luratha/core/logging/logger";
import type { FeedPhoto, FeedProduct, FeedVariant } from "./googleMerchantFeed";

/**
 * Feed-relevant fields projected from each product document. Listing them
 * explicitly keeps the two embedding vectors (`vectorEmbedding`,
 * `searchEmbedding`, up to 2048 floats each) off the wire — they are useless for
 * the feed and dominate document size.
 */
const FEED_FIELDS = [
  "id",
  "slug",
  "title",
  "description",
  "sku",
  "gtin",
  "brandName",
  "googleProductCategoryId",
  "condition",
  "price",
  "totalStock",
  "adult",
  "isBundle",
  "multipack",
  "age_group",
  "gender",
  "color",
  "size",
  "sizeType",
  "sizeSystem",
  "material",
  "pattern",
  "dimensions",
  "productDetail",
  "productHighlight",
  "seasonalTags",
  "photoAssets",
  "variants",
] as const;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Converts a Firestore Timestamp (or already-ISO string) to ISO-8601, else null. */
function toIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string" && value.trim().length > 0) return value;
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mapPhotos(value: unknown): FeedPhoto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((asset) => {
    const record = asRecord(asset);
    if (!record) return [];
    const id = asString(record.id);
    const desktop = asRecord(asRecord(record.resolutions)?.desktop);
    const url = asString(desktop?.downloadUrl);
    return id && url ? [{ id, url }] : [];
  });
}

function mapVariants(value: unknown): FeedVariant[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];
    const sku = asString(record.sku);
    if (!sku) return [];
    return [
      {
        sku,
        gtin: asString(record.gtin),
        colors: asStringArray(record.color),
        sizes: asStringArray(record.size),
        photoIds: asStringArray(record.photoIds),
        // schema default is `true`; only an explicit `false` disables the variant.
        active: record.active !== false,
      },
    ];
  });
}

function mapDetails(value: unknown): FeedProduct["productDetails"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];
    const section = asString(record.section_name);
    const attribute = asString(record.attribute_name);
    const detailValue = asString(record.attribute_value);
    return section && attribute && detailValue ? [{ section, attribute, value: detailValue }] : [];
  });
}

function mapCondition(value: unknown): FeedProduct["condition"] {
  const condition = asString(value);
  return condition === "used" || condition === "refurbished" ? condition : "new";
}

function mapToFeedProduct(raw: unknown, fallbackId: string): FeedProduct {
  const data = asRecord(raw) ?? {};
  const price = asRecord(data.price) ?? {};
  const dimensions = asRecord(data.dimensions);

  return {
    id: asString(data.id) ?? fallbackId,
    slug: asString(data.slug) ?? "",
    title: asString(data.title) ?? "",
    description: asString(data.description) ?? "",
    sku: asString(data.sku) ?? "",
    gtin: asString(data.gtin),
    brandName: asString(data.brandName) ?? "Luratha",
    googleProductCategoryId: asString(data.googleProductCategoryId),
    condition: mapCondition(data.condition),
    price: asNumber(price.price) ?? 0,
    salePrice: asNumber(price.salePrice),
    saleStartDate: toIso(price.startDate),
    saleEndDate: toIso(price.endDate),
    currency: asString(price.currency) ?? "BRL",
    totalStock: asNumber(data.totalStock) ?? 0,
    adult: data.adult === true,
    isBundle: data.isBundle === true,
    multipack: asNumber(data.multipack) ?? 1,
    ageGroup: asString(data.age_group),
    gender: asString(data.gender),
    colors: asStringArray(data.color),
    sizes: asStringArray(data.size),
    sizeType: asString(data.sizeType),
    sizeSystem: asString(data.sizeSystem),
    material: asStringArray(data.material),
    pattern: asStringArray(data.pattern),
    weightKg: dimensions ? asNumber(dimensions.weightKg) : null,
    productHighlights: asStringArray(data.productHighlight),
    productDetails: mapDetails(data.productDetail),
    seasonalTags: asStringArray(data.seasonalTags),
    photos: mapPhotos(data.photoAssets),
    variants: mapVariants(data.variants),
  };
}

/**
 * Reads every active, purchasable product for the catalog feed.
 *
 * Uses the Firestore Enterprise Pipeline API (`searchDb` — the server-only
 * client SDK instance; `firebase-admin` does not expose pipelines). The project
 * runs on Enterprise, so the pipeline is always available — there is **no**
 * Core-query fallback.
 */
export async function fetchFeedProducts(): Promise<FeedProduct[]> {
  const pipeline = searchDb
    .pipeline()
    .collection(firestoreCollections.products)
    .where(and(field("status").equal("active"), field("isPurchasable").equal(true)))
    .select(...FEED_FIELDS);

  try {
    const snapshot = await execute(pipeline);
    return snapshot.results.map((entry) => mapToFeedProduct(entry.data(), entry.id ?? ""));
  } catch (err) {
    if (err instanceof FirebaseError) {
      // Add context to the operational log; the route maps the rethrow to a 500.
      logger.error("[feeds] product pipeline read failed", { err });
    }
    throw err;
  }
}
