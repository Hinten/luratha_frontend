import { describe, expect, it } from "vitest";
import type { Product, Stock } from "@luratha/schemas";
import type { CartItemInput } from "@luratha/repositories/cartsRepository";
import { classifyCartItems } from "../classifyCartItems";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    sku: "SKUP1",
    slug: "produto-p1",
    title: "Produto P1",
    isPurchasable: true,
    status: "active",
    variants: [],
    price: { price: 120, salePrice: null },
    dimensions: { length: 30, width: 22, height: 4, weightKg: 0.35 },
    totalStock: 100,
    ...overrides,
  } as unknown as Product;
}

function makeStock(overrides: Partial<Stock> = {}): Stock {
  return {
    productId: "p1",
    sku: "SKUP1",
    hasVariants: false,
    quantity: 10,
    variants: null,
    ...overrides,
  } as unknown as Stock;
}

function makeItem(overrides: Partial<CartItemInput> = {}): CartItemInput {
  return {
    productId: "p1",
    variantSku: "SKUP1",
    productSlug: "produto-p1",
    name: "Produto P1",
    photoId: "ph1",
    imageUrl: "https://example.com/p1.jpg",
    unitPrice: 120,
    currency: "BRL",
    quantity: 1,
    ...overrides,
  } as CartItemInput;
}

const products = (...list: Product[]) => new Map(list.map((p) => [p.id, p]));
const stocks = (...list: Stock[]) => new Map(list.map((s) => [s.productId, s]));

describe("classifyCartItems", () => {
  it("aceita item com estoque suficiente sem capar", () => {
    const { accepted, dropped } = classifyCartItems(
      [makeItem({ quantity: 2 })],
      products(makeProduct()),
      stocks(makeStock({ quantity: 10 })),
    );
    expect(dropped).toHaveLength(0);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].capped).toBe(false);
    expect(accepted[0].availableQty).toBe(10);
    expect(accepted[0].write.quantity).toBe(2);
  });

  it("capa a quantidade ao disponível quando o pedido excede o estoque", () => {
    const { accepted } = classifyCartItems(
      [makeItem({ quantity: 5 })],
      products(makeProduct()),
      stocks(makeStock({ quantity: 2 })),
    );
    expect(accepted[0].capped).toBe(true);
    expect(accepted[0].requestedQuantity).toBe(5);
    expect(accepted[0].availableQty).toBe(2);
    expect(accepted[0].write.quantity).toBe(2);
  });

  it("dropa item esgotado com reason out_of_stock", () => {
    const { accepted, dropped } = classifyCartItems(
      [makeItem({ quantity: 1 })],
      products(makeProduct()),
      stocks(makeStock({ quantity: 0 })),
    );
    expect(accepted).toHaveLength(0);
    expect(dropped).toEqual([{ productId: "p1", variantId: undefined, reason: "out_of_stock" }]);
  });

  it("dropa produto inexistente", () => {
    const { dropped } = classifyCartItems([makeItem()], products(), stocks());
    expect(dropped[0].reason).toBe("product_not_found");
  });

  it("dropa produto não comprável / arquivado", () => {
    const archived = classifyCartItems(
      [makeItem()],
      products(makeProduct({ status: "archived" })),
      stocks(makeStock()),
    );
    expect(archived.dropped[0].reason).toBe("product_unavailable");

    const notPurchasable = classifyCartItems(
      [makeItem()],
      products(makeProduct({ isPurchasable: false })),
      stocks(makeStock()),
    );
    expect(notPurchasable.dropped[0].reason).toBe("product_unavailable");
  });

  it("dropa SKU divergente do catálogo", () => {
    const { dropped } = classifyCartItems(
      [makeItem({ variantSku: "WRONGSKU" })],
      products(makeProduct()),
      stocks(makeStock()),
    );
    expect(dropped[0].reason).toBe("sku_mismatch");
  });

  it("dropa variante inativa e exige variantId quando o produto tem variantes", () => {
    const variableProduct = makeProduct({
      variants: [
        { id: "var-m", sku: "SKUM", active: true },
        { id: "var-g", sku: "SKUG", active: false },
      ] as unknown as Product["variants"],
    });

    const inactive = classifyCartItems(
      [makeItem({ variantId: "var-g", variantSku: "SKUG" })],
      products(variableProduct),
      stocks(makeStock({ hasVariants: true, variants: { "var-m": 5, "var-g": 5 } })),
    );
    expect(inactive.dropped[0].reason).toBe("variant_unavailable");

    const missingVariant = classifyCartItems(
      [makeItem({ variantSku: "SKUM" })],
      products(variableProduct),
      stocks(makeStock({ hasVariants: true, variants: { "var-m": 5, "var-g": 5 } })),
    );
    expect(missingVariant.dropped[0].reason).toBe("variant_required");
  });

  it("resolve estoque por variante (variant-aware) e capa no disponível da variante", () => {
    const variableProduct = makeProduct({
      variants: [{ id: "var-m", sku: "SKUM", active: true }] as unknown as Product["variants"],
    });
    const { accepted } = classifyCartItems(
      [makeItem({ variantId: "var-m", variantSku: "SKUM", quantity: 4 })],
      products(variableProduct),
      stocks(makeStock({ hasVariants: true, quantity: 5, variants: { "var-m": 3 } })),
    );
    expect(accepted[0].availableQty).toBe(3);
    expect(accepted[0].write.quantity).toBe(3);
    expect(accepted[0].capped).toBe(true);
  });

  it("refresca o preço do catálogo (usa salePrice quando presente)", () => {
    const { accepted } = classifyCartItems(
      [makeItem({ unitPrice: 1 })],
      products(makeProduct({ price: { price: 120, salePrice: 99 } as Product["price"] })),
      stocks(makeStock()),
    );
    expect(accepted[0].write.unitPrice).toBe(99);
  });

  it("cai pra product.totalStock quando não há doc de estoque", () => {
    const { accepted, dropped } = classifyCartItems(
      [makeItem({ quantity: 2 })],
      products(makeProduct({ totalStock: 7 })),
      stocks(),
    );
    expect(dropped).toHaveLength(0);
    expect(accepted[0].availableQty).toBe(7);
  });
});
