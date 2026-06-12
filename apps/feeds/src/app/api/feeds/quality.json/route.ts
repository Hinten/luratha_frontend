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
 *
 * Dev-only: the report is publicly cacheable (`Cache-Control: public`) and has
 * no auth, so in production/preview it would leak catalog gaps through shared
 * caches. Until it gets a proper guard (bearer token + `private` caching),
 * serve it only under `pnpm dev`; production responds 404. The production
 * guard is tracked in issue #207.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

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
