import { NextResponse } from "next/server";
import { fetchFeedProducts } from "@/src/lib/feed/fetchFeedProducts";
import { buildGoogleMerchantFeed } from "@/src/lib/feed/googleMerchantFeed";
import { SITE_URL } from "@/src/lib/constants";

export const runtime = "nodejs";
// ISR: regenerate at most once per hour so bot/Google traffic cannot turn the
// whole-catalog read into a per-request Firestore cost.
export const revalidate = 3600;

/**
 * GET /api/feeds/products.xml
 *
 * Google Merchant Center product feed (RSS 2.0 + `g:` namespace). The
 * Facebook/Meta Catalog ingests the same document. Point the Merchant Center
 * scheduled fetch (and the Commerce Manager data source) at this URL.
 */
export async function GET() {
  const products = await fetchFeedProducts();
  const xml = buildGoogleMerchantFeed(products, { siteUrl: SITE_URL });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex",
    },
  });
}
