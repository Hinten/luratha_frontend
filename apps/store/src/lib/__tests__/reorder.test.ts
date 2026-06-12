import { describe, it, expect } from "vitest";
import {
  validateProduct,
  validateStock,
  type OrderItem,
  type Product,
  type Stock,
} from "@luratha/schemas";
import { buildReorderItem } from "@/src/lib/reorder";

const BASE_TIMESTAMP = "2026-01-01T00:00:00.000Z";

const BASE_PRICE = {
  price: 389,
  currency: "BRL" as const,
  salePrice: null,
  priceMin: null,
  priceMax: null,
  startDate: null,
  endDate: null,
};

function makeResolution(downloadUrl: string) {
  return {
    width: 800,
    height: 1000,
    storagePath: "products/asset.webp",
    downloadUrl,
    format: "webp" as const,
  };
}

function makePhotoAsset(id: string, url: string) {
  return {
    id,
    alt: null,
    resolutions: {
      card: makeResolution(url),
      mobile: makeResolution(url),
      tablet: makeResolution(url),
      desktop: makeResolution(url),
    },
    createdAt: BASE_TIMESTAMP,
    updatedAt: BASE_TIMESTAMP,
  };
}

function makeProduct(overrides: Record<string, unknown> = {}): Product {
  return validateProduct({
    id: "prod-1",
    title: "Vestido Bordado",
    sku: "VB_001_T",
    description: "Um vestido artesanal",
    categoryId: "cat-1",
    price: BASE_PRICE,
    status: "active",
    isPurchasable: true,
    totalStock: 10,
    photoAssets: [makePhotoAsset("photo-1", "https://cdn.example.com/photo-1.webp")],
    lifeStylePhotos: [],
    createdAt: BASE_TIMESTAMP,
    updatedAt: BASE_TIMESTAMP,
    ...overrides,
  });
}

function makeStock(overrides: Record<string, unknown> = {}): Stock {
  return validateStock({
    productId: "prod-1",
    sku: "VB_001_T",
    quantity: 10,
    hasVariants: false,
    variants: null,
    updatedAt: BASE_TIMESTAMP,
    ...overrides,
  });
}

function makeOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "item-1",
    productId: "prod-1",
    itemSku: "VB_001_T",
    name: "Nome antigo do snapshot",
    photoId: "photo-1",
    quantity: 2,
    unitPrice: 200, // preço antigo (snapshot) — deve ser ignorado
    lineTotal: 400,
    currency: "BRL",
    ...overrides,
  };
}

describe("buildReorderItem", () => {
  it("mapeia um produto simples com os dados ATUAIS do catálogo", () => {
    const product = makeProduct();
    const result = buildReorderItem(makeOrderItem(), product, makeStock());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item).toEqual({
      productId: "prod-1",
      variantSku: "VB_001_T",
      productSlug: product.slug,
      name: "Vestido Bordado", // título atual, não o do snapshot
      photoId: "photo-1",
      imageUrl: "https://cdn.example.com/photo-1.webp",
      unitPrice: 389, // preço atual, não o do snapshot (200)
      currency: "BRL",
      quantity: 2, // quantidade do pedido
    });
  });

  it("usa salePrice quando presente", () => {
    const product = makeProduct({
      price: { ...BASE_PRICE, price: 389, salePrice: 299 },
    });
    const result = buildReorderItem(makeOrderItem(), product, makeStock());
    expect(result.ok && result.item.unitPrice).toBe(299);
  });

  it("preserva a quantidade do pedido, capada em 99", () => {
    const result = buildReorderItem(
      makeOrderItem({ quantity: 150 }),
      makeProduct(),
      makeStock({ quantity: 999 }),
    );
    expect(result.ok && result.item.quantity).toBe(99);
  });

  it("resolve a variante e monta o variantLabel", () => {
    const product = makeProduct({
      color: ["Azul"],
      size: ["P"],
      variants: [
        {
          id: "v1",
          sku: "VB_V1_001",
          color: ["Azul"],
          size: ["P"],
          photoIds: [],
        },
      ],
    });
    const stock = makeStock({ hasVariants: true, variants: { v1: 3 }, quantity: 3 });
    const result = buildReorderItem(makeOrderItem({ variantId: "v1" }), product, stock);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item.variantId).toBe("v1");
    expect(result.item.variantSku).toBe("VB_V1_001");
    expect(result.item.variantLabel).toBe("Azul / P");
  });

  it("pula quando o produto foi removido", () => {
    const result = buildReorderItem(makeOrderItem(), null, null);
    expect(result).toEqual({ ok: false, reason: "removido" });
  });

  it("pula quando o produto não é comprável ou não está ativo", () => {
    expect(
      buildReorderItem(makeOrderItem(), makeProduct({ isPurchasable: false }), makeStock()),
    ).toEqual({
      ok: false,
      reason: "indisponível",
    });
    expect(
      buildReorderItem(makeOrderItem(), makeProduct({ status: "archived" }), makeStock()),
    ).toEqual({
      ok: false,
      reason: "indisponível",
    });
  });

  it("pula quando a variante sumiu ou está inativa", () => {
    const productMissing = makeProduct({
      variants: [{ id: "v1", sku: "VB_V1_001", color: ["Azul"], size: ["P"], photoIds: [] }],
    });
    expect(
      buildReorderItem(makeOrderItem({ variantId: "v9" }), productMissing, makeStock()),
    ).toEqual({ ok: false, reason: "indisponível" });

    const productInactive = makeProduct({
      variants: [
        { id: "v1", sku: "VB_V1_001", color: ["Azul"], size: ["P"], photoIds: [], active: false },
      ],
    });
    const stock = makeStock({ hasVariants: true, variants: { v1: 3 }, quantity: 3 });
    expect(buildReorderItem(makeOrderItem({ variantId: "v1" }), productInactive, stock)).toEqual({
      ok: false,
      reason: "indisponível",
    });
  });

  it("pula um item simples cujo produto agora tem variantes (ambíguo)", () => {
    const product = makeProduct({
      variants: [{ id: "v1", sku: "VB_V1_001", color: ["Azul"], size: ["P"], photoIds: [] }],
    });
    expect(buildReorderItem(makeOrderItem(), product, makeStock())).toEqual({
      ok: false,
      reason: "indisponível",
    });
  });

  it("pula quando está sem estoque (produto simples e variante)", () => {
    expect(buildReorderItem(makeOrderItem(), makeProduct(), makeStock({ quantity: 0 }))).toEqual({
      ok: false,
      reason: "sem estoque",
    });

    const product = makeProduct({
      variants: [{ id: "v1", sku: "VB_V1_001", color: ["Azul"], size: ["P"], photoIds: [] }],
    });
    const stock = makeStock({ hasVariants: true, variants: { v1: 0 }, quantity: 0 });
    expect(buildReorderItem(makeOrderItem({ variantId: "v1" }), product, stock)).toEqual({
      ok: false,
      reason: "sem estoque",
    });
  });

  it("cai no totalStock do produto quando não há doc de estoque", () => {
    const ok = buildReorderItem(makeOrderItem(), makeProduct({ totalStock: 5 }), null);
    expect(ok.ok).toBe(true);
    const out = buildReorderItem(makeOrderItem(), makeProduct({ totalStock: 0 }), null);
    expect(out).toEqual({ ok: false, reason: "sem estoque" });
  });

  it("pula quando o produto não tem nenhuma imagem", () => {
    const result = buildReorderItem(makeOrderItem(), makeProduct({ photoAssets: [] }), makeStock());
    expect(result).toEqual({ ok: false, reason: "sem imagem" });
  });

  it("usa a 1ª imagem do produto quando o photoId do pedido não existe mais", () => {
    const product = makeProduct({
      photoAssets: [makePhotoAsset("photo-novo", "https://cdn.example.com/novo.webp")],
    });
    const result = buildReorderItem(
      makeOrderItem({ photoId: "photo-antigo" }),
      product,
      makeStock(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.item.photoId).toBe("photo-novo");
    expect(result.item.imageUrl).toBe("https://cdn.example.com/novo.webp");
  });
});
