import { describe, expect, it } from "vitest";
import type { OrderItem, Product, Stock } from "@luratha/schemas";
import { planStockDecrement, planStockRelease, resolveAvailableQty } from "../orderStock";

const NOW = "2026-06-12T12:00:00.000Z";

/** Fixture mínima — o planejador só lê `id` e `totalStock` do produto. */
function product(id: string, totalStock: number): Product {
  return { id, totalStock } as Product;
}

function item(partial: {
  productId: string;
  variantId?: string;
  quantity: number;
  name?: string;
}): OrderItem {
  return {
    id: partial.variantId ? `${partial.productId}__${partial.variantId}` : partial.productId,
    productId: partial.productId,
    ...(partial.variantId ? { variantId: partial.variantId } : {}),
    name: partial.name ?? `Produto ${partial.productId}`,
    quantity: partial.quantity,
  } as OrderItem;
}

function simpleStock(productId: string, quantity: number): Stock {
  return {
    productId,
    sku: "SKU_TEST_SIMPLE",
    quantity,
    hasVariants: false,
    variants: null,
    updatedAt: NOW,
  };
}

function variantStock(productId: string, variants: Record<string, number>): Stock {
  return {
    productId,
    sku: "SKU_TEST_VARIANT",
    quantity: Object.values(variants).reduce((a, b) => a + b, 0),
    hasVariants: true,
    variants,
    updatedAt: NOW,
  };
}

function asMap<T extends { id?: string; productId?: string }>(entries: T[]): Map<string, T> {
  return new Map(entries.map((e) => [(e.id ?? e.productId)!, e]));
}

describe("resolveAvailableQty", () => {
  it("prioriza o estoque por variante quando hasVariants e variantId presentes", () => {
    const stock = variantStock("p1", { v1: 3, v2: 0 });
    expect(resolveAvailableQty(product("p1", 99), stock, "v1")).toBe(3);
    expect(resolveAvailableQty(product("p1", 99), stock, "v2")).toBe(0);
    expect(resolveAvailableQty(product("p1", 99), stock, "v_inexistente")).toBe(0);
  });

  it("usa quantity para doc simples e totalStock quando não há doc", () => {
    expect(resolveAvailableQty(product("p1", 99), simpleStock("p1", 7), undefined)).toBe(7);
    expect(resolveAvailableQty(product("p1", 4), null, undefined)).toBe(4);
    expect(resolveAvailableQty(product("p1", 4), null, "v1")).toBe(4);
  });
});

describe("planStockDecrement", () => {
  it("decrementa doc simples + totalStock", () => {
    const result = planStockDecrement(
      [item({ productId: "p1", quantity: 2 })],
      asMap([product("p1", 5)]),
      asMap([simpleStock("p1", 5)]),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextStocks).toHaveLength(1);
    expect(result.nextStocks[0].quantity).toBe(3);
    expect(result.nextStocks[0].updatedAt).toBe(NOW);
    expect(result.nextTotalStockByProduct.get("p1")).toBe(3);
    expect(result.warnings).toHaveLength(0);
  });

  it("decrementa a variante certa preservando a invariante quantity == Σ variants", () => {
    const result = planStockDecrement(
      [item({ productId: "p1", variantId: "v1", quantity: 2 })],
      asMap([product("p1", 5)]),
      asMap([variantStock("p1", { v1: 3, v2: 2 })]),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextStocks[0].variants).toEqual({ v1: 1, v2: 2 });
    expect(result.nextStocks[0].quantity).toBe(3);
    expect(result.nextTotalStockByProduct.get("p1")).toBe(3);
  });

  it("agrega múltiplas linhas do mesmo produto (variantes distintas)", () => {
    const result = planStockDecrement(
      [
        item({ productId: "p1", variantId: "v1", quantity: 2 }),
        item({ productId: "p1", variantId: "v2", quantity: 1 }),
      ],
      asMap([product("p1", 5)]),
      asMap([variantStock("p1", { v1: 3, v2: 2 })]),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextStocks).toHaveLength(1);
    expect(result.nextStocks[0].variants).toEqual({ v1: 1, v2: 1 });
    expect(result.nextStocks[0].quantity).toBe(2);
    expect(result.nextTotalStockByProduct.get("p1")).toBe(2);
  });

  it("linhas múltiplas da mesma variante enxergam o rascunho já decrementado", () => {
    const result = planStockDecrement(
      [
        item({ productId: "p1", variantId: "v1", quantity: 2 }),
        item({ productId: "p1", variantId: "v1", quantity: 2, name: "Vestido" }),
      ],
      asMap([product("p1", 3)]),
      asMap([variantStock("p1", { v1: 3 })]),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.insufficient).toEqual([
      { productId: "p1", variantId: "v1", name: "Vestido", available: 1, requested: 2 },
    ]);
  });

  it("lista TODAS as faltas, não só a primeira", () => {
    const result = planStockDecrement(
      [
        item({ productId: "p1", quantity: 5, name: "Conjunto" }),
        item({ productId: "p2", variantId: "v1", quantity: 1, name: "Vestido" }),
      ],
      asMap([product("p1", 2), product("p2", 0)]),
      asMap([simpleStock("p1", 2), variantStock("p2", { v1: 0 })]),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.insufficient).toEqual([
      { productId: "p1", name: "Conjunto", available: 2, requested: 5 },
      { productId: "p2", variantId: "v1", name: "Vestido", available: 0, requested: 1 },
    ]);
  });

  it("sem doc de stock: valida e decrementa só o totalStock (com warning)", () => {
    const result = planStockDecrement(
      [item({ productId: "p1", quantity: 2 })],
      asMap([product("p1", 5)]),
      new Map(),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextStocks).toHaveLength(0);
    expect(result.nextTotalStockByProduct.get("p1")).toBe(3);
    expect(result.warnings).toHaveLength(1);
  });

  it("sem doc de stock e totalStock insuficiente → falta com available = totalStock", () => {
    const result = planStockDecrement(
      [item({ productId: "p1", quantity: 3, name: "Moletom" })],
      asMap([product("p1", 1)]),
      new Map(),
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.insufficient).toEqual([
      { productId: "p1", name: "Moletom", available: 1, requested: 3 },
    ]);
  });

  it("drift (stock com variantes, item sem variantId) → fallback totalStock, sem escrita no doc", () => {
    const result = planStockDecrement(
      [item({ productId: "p1", quantity: 1 })],
      asMap([product("p1", 5)]),
      asMap([variantStock("p1", { v1: 5 })]),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextStocks).toHaveLength(0);
    expect(result.nextTotalStockByProduct.get("p1")).toBe(4);
    expect(result.warnings).toHaveLength(1);
  });

  it("doc simples com variantId no item (pool compartilhado) decrementa quantity", () => {
    const result = planStockDecrement(
      [item({ productId: "p1", variantId: "v1", quantity: 2 })],
      asMap([product("p1", 5)]),
      asMap([simpleStock("p1", 5)]),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextStocks[0].quantity).toBe(3);
  });

  it("clampa o totalStock denormalizado em 0 quando ele está abaixo do doc de stock", () => {
    // Drift: doc diz 5, espelho diz 1. Vende 3 → doc fica 2, espelho clampa em 0.
    const result = planStockDecrement(
      [item({ productId: "p1", quantity: 3 })],
      asMap([product("p1", 1)]),
      asMap([simpleStock("p1", 5)]),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nextStocks[0].quantity).toBe(2);
    expect(result.nextTotalStockByProduct.get("p1")).toBe(0);
  });
});

describe("planStockRelease", () => {
  it("devolve quantidades simetricamente (doc + totalStock)", () => {
    const plan = planStockRelease(
      [item({ productId: "p1", variantId: "v1", quantity: 2 })],
      asMap([product("p1", 3)]),
      asMap([variantStock("p1", { v1: 1, v2: 2 })]),
      NOW,
    );
    expect(plan.nextStocks[0].variants).toEqual({ v1: 3, v2: 2 });
    expect(plan.nextStocks[0].quantity).toBe(5);
    expect(plan.nextTotalStockByProduct.get("p1")).toBe(5);
    expect(plan.warnings).toHaveLength(0);
  });

  it("re-cria a chave de variante removida do mapa após a venda", () => {
    const plan = planStockRelease(
      [item({ productId: "p1", variantId: "v_sumida", quantity: 1 })],
      asMap([product("p1", 0)]),
      asMap([variantStock("p1", { v1: 2 })]),
      NOW,
    );
    expect(plan.nextStocks[0].variants).toEqual({ v1: 2, v_sumida: 1 });
    expect(plan.nextStocks[0].quantity).toBe(3);
  });

  it("doc de stock sumido → devolve só o totalStock (com warning)", () => {
    const plan = planStockRelease(
      [item({ productId: "p1", quantity: 2 })],
      asMap([product("p1", 0)]),
      new Map(),
      NOW,
    );
    expect(plan.nextStocks).toHaveLength(0);
    expect(plan.nextTotalStockByProduct.get("p1")).toBe(2);
    expect(plan.warnings).toHaveLength(1);
  });

  it("produto deletado → devolve só o doc de stock (com warning)", () => {
    const plan = planStockRelease(
      [item({ productId: "p1", quantity: 2 })],
      new Map(),
      asMap([simpleStock("p1", 0)]),
      NOW,
    );
    expect(plan.nextStocks[0].quantity).toBe(2);
    expect(plan.nextTotalStockByProduct.has("p1")).toBe(false);
    expect(plan.warnings).toHaveLength(1);
  });
});
