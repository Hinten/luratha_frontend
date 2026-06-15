import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminStockConverter } from "@luratha/firestore/adminStockConverter";
import { firestoreCollections, validateStock, type Stock } from "@luratha/schemas";

/**
 * Fixtures de catálogo compartilhados pelas suites cloud que precisam de
 * produtos reais no Firestore (`cartApi`, `ordersApi`, …). Extraídos do
 * `cartApi.cloud.test.ts` quando o `POST /api/orders` passou a validar
 * itens/estoque contra o catálogo (toda suite que cria pedido precisa seedar
 * produto + stock).
 *
 * Sempre use um `createCloudTestPrefix()` por suite para isolar runs
 * concorrentes, e rastreie os ids para cleanup no `afterAll`.
 */

export type SeedDocument = { collection: string; id: string };

export const SIMPLE_SKU_TOKEN = "SIMPLE_AAAA";
export const VARIANT_M_SKU = "SKUVARM_BBBB";
export const VARIANT_G_SKU = "SKUVARG_CCCC";

export function buildPhotoAsset(productId: string, assetId: string) {
  const now = new Date().toISOString();
  const url = (label: string) => `https://example.com/${productId}/${assetId}/${label}.webp`;
  return {
    id: assetId,
    alt: "foto teste",
    resolutions: {
      mobile: {
        width: 480,
        height: 600,
        storagePath: `products/${productId}/${assetId}/mobile.webp`,
        downloadUrl: url("mobile"),
        format: "webp",
      },
      tablet: {
        width: 768,
        height: 960,
        storagePath: `products/${productId}/${assetId}/tablet.webp`,
        downloadUrl: url("tablet"),
        format: "webp",
      },
      desktop: {
        width: 1200,
        height: 1500,
        storagePath: `products/${productId}/${assetId}/desktop.webp`,
        downloadUrl: url("desktop"),
        format: "webp",
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

/** Produto simples (sem variantes), preço 120, totalStock 5. */
export function buildSimpleProduct(prefix: string) {
  const id = `${prefix}-prod-simple`;
  const now = new Date().toISOString();
  const photo = buildPhotoAsset(id, `${prefix}-photo-simple`);
  return {
    id,
    slug: null,
    title: "Camisa Linho Teste",
    shortTitle: null,
    description: "Produto simples — sem variantes — usado nos cloud tests.",
    vectorEmbedding: null,
    searchEmbedding: null,
    sku: SIMPLE_SKU_TOKEN,
    gtin: null,
    mpn: null,
    status: "active" as const,
    isPurchasable: true,
    brandName: "Luratha Test",
    categoryId: `cat-${prefix}`,
    googleProductCategoryId: null,
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: {
      price: 120,
      salePrice: null,
      priceMin: null,
      priceMax: null,
      currency: "BRL" as const,
      startDate: null,
      endDate: null,
    },
    salePrice: null,
    condition: "new" as const,
    adult: false,
    isBundle: false,
    multipack: 1,
    age_group: null,
    gender: null,
    color: null,
    size: null,
    sizeType: null,
    sizeSystem: null,
    material: [],
    pattern: [],
    dimensions: {
      length: 30,
      width: 22,
      height: 4,
      unit: "cm" as const,
      weightKg: 0.35,
      weightGrossKg: 0.4,
    },
    productDetail: null,
    productHighlight: null,
    photoAssets: [photo],
    lifeStylePhotos: [],
    videoUrls: [],
    ratingAverage: null,
    reviewCount: null,
    totalStock: 5,
    variants: null,
    createdAt: now,
    updatedAt: now,
    photoId: photo.id,
  };
}

/** Produto com variantes M (ativa) e G (inativa), preço 280, totalStock 10. */
export function buildVariableProduct(prefix: string) {
  const id = `${prefix}-prod-variable`;
  const now = new Date().toISOString();
  const photo = buildPhotoAsset(id, `${prefix}-photo-variable`);
  return {
    id,
    slug: null,
    title: "Vestido Bordado Teste",
    shortTitle: null,
    description: "Produto com variantes M/G para testar variantId.",
    vectorEmbedding: null,
    searchEmbedding: null,
    sku: `PARENT_AAAA_${prefix.slice(-4).toUpperCase()}`,
    gtin: null,
    mpn: null,
    status: "active" as const,
    isPurchasable: true,
    brandName: "Luratha Test",
    categoryId: `cat-${prefix}`,
    googleProductCategoryId: null,
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: {
      price: 280,
      salePrice: null,
      priceMin: null,
      priceMax: null,
      currency: "BRL" as const,
      startDate: null,
      endDate: null,
    },
    salePrice: null,
    condition: "new" as const,
    adult: false,
    isBundle: false,
    multipack: 1,
    age_group: null,
    gender: null,
    color: null,
    size: null,
    sizeType: null,
    sizeSystem: null,
    material: [],
    pattern: [],
    dimensions: null,
    productDetail: null,
    productHighlight: null,
    photoAssets: [photo],
    lifeStylePhotos: [],
    videoUrls: [],
    ratingAverage: null,
    reviewCount: null,
    totalStock: 10,
    variants: [
      {
        id: "var-m",
        sku: VARIANT_M_SKU,
        gtin: null,
        mpn: null,
        item_group_id: null,
        color: null,
        size: ["M"],
        photoIds: [photo.id],
        active: true,
      },
      {
        id: "var-g",
        sku: VARIANT_G_SKU,
        gtin: null,
        mpn: null,
        item_group_id: null,
        color: null,
        size: ["G"],
        photoIds: [photo.id],
        active: false, // inactive variant — used to test "variante indisponível"
      },
    ],
    createdAt: now,
    updatedAt: now,
    photoId: photo.id,
  };
}

export async function seedProduct(product: Record<string, unknown>): Promise<void> {
  await adminDb
    .collection(firestoreCollections.products)
    .doc(product.id as string)
    .set(product);
}

/** Grava (sobrescrevendo) um doc da coleção `stock` validado pelo schema. */
export async function seedStockDoc(stock: {
  productId: string;
  sku: string;
  quantity: number;
  variants?: Record<string, number> | null;
}): Promise<Stock> {
  const doc = validateStock({
    productId: stock.productId,
    sku: stock.sku,
    quantity: stock.quantity,
    hasVariants: Boolean(stock.variants),
    variants: stock.variants ?? null,
    updatedAt: new Date().toISOString(),
  });
  await adminDb
    .collection(firestoreCollections.stock)
    .doc(doc.productId)
    .withConverter(adminStockConverter)
    .set(doc);
  return doc;
}

export async function readStockDoc(productId: string): Promise<Stock | null> {
  const snap = await adminDb
    .collection(firestoreCollections.stock)
    .doc(productId)
    .withConverter(adminStockConverter)
    .get();
  return snap.exists ? snap.data()! : null;
}

export async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}
