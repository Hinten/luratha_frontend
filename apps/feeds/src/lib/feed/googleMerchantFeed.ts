/**
 * Pure builder for the Google Merchant Center product feed (RSS 2.0 + the `g:`
 * namespace). The Facebook/Meta Catalog ingests the same format. This module has
 * no Firebase imports on purpose, so it is fully unit-testable from a plain
 * `FeedProduct[]`. The Firestore → `FeedProduct` mapping lives in
 * `fetchFeedProducts.ts`.
 *
 * Variant handling: one `<item>` per active variant, and one per size when a
 * variant lists several. All expanded items share `g:item_group_id` = the parent
 * product id so the platforms group them as a single product. Availability and
 * price are inherited from the parent product (the schema has no per-variant
 * stock/price — documented limitation).
 */

const GMC_NAMESPACE = "http://base.google.com/ns/1.0";
/** Google Merchant Center accepts up to 10 additional images per item. */
const MAX_ADDITIONAL_IMAGES = 10;

export interface FeedPhoto {
  id: string;
  url: string;
}

export interface FeedVariant {
  sku: string;
  gtin: string | null;
  colors: string[];
  sizes: string[];
  photoIds: string[];
  active: boolean;
}

export interface FeedProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  sku: string;
  gtin: string | null;
  brandName: string;
  googleProductCategoryId: string | null;
  condition: "new" | "used" | "refurbished";
  /** Decimal amount in `currency` (e.g. 129.9), not cents. */
  price: number;
  salePrice: number | null;
  /** ISO-8601 — only emitted as `sale_price_effective_date` when both are present. */
  saleStartDate: string | null;
  saleEndDate: string | null;
  currency: string;
  totalStock: number;
  adult: boolean;
  isBundle: boolean;
  multipack: number;
  ageGroup: string | null;
  gender: string | null;
  colors: string[];
  sizes: string[];
  sizeType: string | null;
  sizeSystem: string | null;
  material: string[];
  pattern: string[];
  weightKg: number | null;
  productHighlights: string[];
  productDetails: { section: string; attribute: string; value: string }[];
  seasonalTags: string[];
  photos: FeedPhoto[];
  variants: FeedVariant[] | null;
}

export interface FeedChannelInfo {
  siteUrl: string;
  title?: string;
  description?: string;
}

/** One purchasable offer derived from a product (a variant, a size, or the product itself). */
interface FeedOffer {
  id: string;
  itemGroupId: string | null;
  mpn: string;
  gtin: string | null;
  color: string | null;
  size: string | null;
  photos: FeedPhoto[];
}

/** Escapes the five XML predefined entities. `&` must be replaced first. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function joinValues(values: string[]): string | null {
  const cleaned = values.map((v) => v.trim()).filter((v) => v.length > 0);
  return cleaned.length > 0 ? cleaned.join("/") : null;
}

function pickPhotos(product: FeedProduct, photoIds: string[]): FeedPhoto[] {
  if (photoIds.length > 0) {
    const matched = product.photos.filter((photo) => photoIds.includes(photo.id));
    if (matched.length > 0) return matched;
  }
  return product.photos;
}

function expandOffers(product: FeedProduct): FeedOffer[] {
  if (product.variants && product.variants.length > 0) {
    const offers: FeedOffer[] = [];
    for (const variant of product.variants) {
      if (!variant.active) continue;
      const color = joinValues(variant.colors.length > 0 ? variant.colors : product.colors);
      const photos = pickPhotos(product, variant.photoIds);
      const gtin = variant.gtin ?? product.gtin;
      const sizes = variant.sizes.length > 0 ? variant.sizes : [null];
      for (const size of sizes) {
        offers.push({
          id: size ? `${variant.sku}-${size}` : variant.sku,
          itemGroupId: product.id,
          mpn: variant.sku,
          gtin,
          color,
          size,
          photos,
        });
      }
    }
    return offers;
  }

  // Simple product: expand per size when several are declared, otherwise a
  // single offer keyed by the product id.
  const sizes = product.sizes.length > 0 ? product.sizes : [null];
  const grouped = sizes.length > 1;
  const color = joinValues(product.colors);
  return sizes.map((size) => ({
    id: size ? `${product.id}-${size}` : product.id,
    itemGroupId: grouped ? product.id : null,
    mpn: product.sku,
    gtin: product.gtin,
    color,
    size,
    photos: product.photos,
  }));
}

function renderItem(product: FeedProduct, offer: FeedOffer, channel: FeedChannelInfo): string {
  const lines: string[] = [];
  const push = (name: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (text.length === 0) return;
    lines.push(`      <${name}>${escapeXml(text)}</${name}>`);
  };

  push("g:id", offer.id);
  if (offer.itemGroupId) push("g:item_group_id", offer.itemGroupId);
  push("g:title", product.title);
  push("g:description", product.description);
  push("g:link", `${channel.siteUrl}/produto/${product.slug}`);

  const [primaryPhoto, ...rest] = offer.photos;
  if (primaryPhoto) push("g:image_link", primaryPhoto.url);
  for (const photo of rest.slice(0, MAX_ADDITIONAL_IMAGES)) {
    push("g:additional_image_link", photo.url);
  }

  push("g:availability", product.totalStock > 0 ? "in stock" : "out of stock");
  push("g:price", `${product.price.toFixed(2)} ${product.currency}`);
  if (product.salePrice !== null) {
    push("g:sale_price", `${product.salePrice.toFixed(2)} ${product.currency}`);
    if (product.saleStartDate && product.saleEndDate) {
      push("g:sale_price_effective_date", `${product.saleStartDate}/${product.saleEndDate}`);
    }
  }

  push("g:brand", product.brandName);
  push("g:mpn", offer.mpn);
  if (offer.gtin) push("g:gtin", offer.gtin);
  push("g:condition", product.condition);
  push("g:google_product_category", product.googleProductCategoryId);
  push("g:size", offer.size);
  push("g:color", offer.color);
  push("g:material", joinValues(product.material));
  push("g:pattern", joinValues(product.pattern));
  push("g:age_group", product.ageGroup);
  push("g:gender", product.gender);
  push("g:size_type", product.sizeType);
  push("g:size_system", product.sizeSystem);
  if (product.weightKg !== null) push("g:shipping_weight", `${product.weightKg} kg`);
  if (product.multipack > 1) push("g:multipack", product.multipack);
  if (product.isBundle) push("g:is_bundle", "yes");
  if (product.adult) push("g:adult", "yes");
  for (const highlight of product.productHighlights) push("g:product_highlight", highlight);
  for (const detail of product.productDetails) {
    lines.push(
      [
        `      <g:product_detail>`,
        `        <g:section_name>${escapeXml(detail.section)}</g:section_name>`,
        `        <g:attribute_name>${escapeXml(detail.attribute)}</g:attribute_name>`,
        `        <g:attribute_value>${escapeXml(detail.value)}</g:attribute_value>`,
        `      </g:product_detail>`,
      ].join("\n"),
    );
  }
  if (product.seasonalTags.length > 0) push("g:custom_label_0", product.seasonalTags.join(", "));

  return `    <item>\n${lines.join("\n")}\n    </item>`;
}

export function buildGoogleMerchantFeed(products: FeedProduct[], channel: FeedChannelInfo): string {
  const title = channel.title ?? "Luratha — Catálogo de produtos";
  const description =
    channel.description ??
    "Feed de produtos da Luratha para Google Merchant Center e Facebook Catalog.";

  const items = products.flatMap((product) =>
    expandOffers(product).map((offer) => renderItem(product, offer, channel)),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:g="${GMC_NAMESPACE}">`,
    `  <channel>`,
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(channel.siteUrl)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    ...items,
    `  </channel>`,
    `</rss>`,
    ``,
  ].join("\n");
}
