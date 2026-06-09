import { NextResponse } from "next/server";
import { logger } from "@luratha/core/logging/logger";
import { fetchFeedProducts } from "@/src/lib/feed/fetchFeedProducts";
import { assessFeedQuality, REQUIRED_FIELD_NAMES } from "@/src/lib/feed/feedQuality";

export const runtime = "nodejs";
export const revalidate = 3600;

/** Below this fill-rate, a required Merchant attribute is logged for operators. */
const REQUIRED_FILL_RATE_THRESHOLD = 0.99;

/**
 * GET /api/feeds/quality.json
 *
 * Internal feed-quality report: per-attribute fill-rate plus the products
 * missing a required Merchant attribute. Complements the external Merchant
 * Center / Commerce Manager diagnostics by catching catalog gaps in-house.
 */
export async function GET() {
  const products = await fetchFeedProducts();
  const report = assessFeedQuality(products);

  if (report.totalItems > 0) {
    const belowThreshold = REQUIRED_FIELD_NAMES.filter(
      (name) => report.required[name].fillRate < REQUIRED_FILL_RATE_THRESHOLD,
    );
    if (belowThreshold.length > 0) {
      logger.warn("[feeds-quality] required attribute below threshold", {
        threshold: REQUIRED_FILL_RATE_THRESHOLD,
        fields: belowThreshold,
        totalItems: report.totalItems,
      });
    }
  }

  return NextResponse.json(report, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex",
    },
  });
}
