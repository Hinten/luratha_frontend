import { type OrderItem, type Product, type Stock, validateStock } from "@luratha/schemas";

/**
 * Planejamento puro de movimentos de estoque de um pedido (decremento na
 * criação, liberação quando o pagamento falha / o pedido é cancelado).
 *
 * Módulo sem `server-only`/`firebase-admin` — espelha `orderStatusPatch.ts` —
 * para ser testável por unidade. Quem executa as escritas é o chamador
 * (`POST /api/orders`, `orderService`), dentro da própria transação que lê os
 * docs de `stock` e `products`.
 *
 * Modelo de dados (ver `packages/schemas/src/stock.ts`):
 *  - coleção `stock`, doc id = productId; `quantity` é o total e, quando
 *    `hasVariants`, `variants` mapeia variantId → qty com a invariante
 *    `quantity == Σ variants` (validada pelo schema em toda escrita).
 *  - `product.totalStock` é um espelho denormalizado para display/feeds — todo
 *    movimento atualiza os dois para a vitrine não anunciar estoque fantasma.
 *
 * Doc de stock ausente (produto sem estoque rastreado): valida/movimenta só o
 * `product.totalStock` — não dá para reconstruir o mapa por variante a partir
 * do escalar sem inventar dados. Backfill é tarefa do admin (`POST /api/stock`).
 */

/** Quantidade disponível para o item, priorizando o estoque por variante. */
export function resolveAvailableQty(
  product: Product,
  stock: Stock | null,
  variantId: string | undefined,
): number {
  if (stock?.hasVariants && variantId) {
    return stock.variants?.[variantId] ?? 0;
  }
  if (stock) {
    return stock.quantity;
  }
  // Sem doc de estoque, cai no total denormalizado do produto.
  return product.totalStock;
}

export interface StockShortage {
  productId: string;
  variantId?: string;
  name: string;
  available: number;
  requested: number;
}

export interface StockMovementPlan {
  /**
   * Docs de `stock` completos (invariante `quantity == Σ variants` preservada)
   * prontos para `tx.set(ref.withConverter(adminStockConverter), doc)`.
   */
  nextStocks: Stock[];
  /** Próximo `product.totalStock` absoluto (clampado em ≥ 0) por productId. */
  nextTotalStockByProduct: Map<string, number>;
  /** Situações degradadas (doc ausente, drift de variante) — o chamador loga. */
  warnings: string[];
}

export type StockDecrementResult =
  ({ ok: true } & StockMovementPlan) | { ok: false; insufficient: StockShortage[] };

interface MovementState {
  drafts: Map<string, Stock>;
  touched: Set<string>;
  totals: Map<string, number>;
  warnings: string[];
}

function createState(): MovementState {
  return { drafts: new Map(), touched: new Set(), totals: new Map(), warnings: [] };
}

/** Cópia de trabalho do doc de stock (mapa de variantes clonado). */
function draftFor(state: MovementState, stocks: ReadonlyMap<string, Stock>, productId: string) {
  const existing = state.drafts.get(productId);
  if (existing) return existing;
  const original = stocks.get(productId);
  if (!original) return null;
  const draft: Stock = {
    ...original,
    variants: original.variants ? { ...original.variants } : null,
  };
  state.drafts.set(productId, draft);
  return draft;
}

function currentTotal(state: MovementState, product: Product): number {
  return state.totals.get(product.id) ?? product.totalStock;
}

function finishPlan(state: MovementState, nowIso: string): StockMovementPlan {
  const nextStocks: Stock[] = [];
  for (const productId of state.touched) {
    const draft = state.drafts.get(productId)!;
    // validateStock reaplica a invariante quantity == Σ variants — se a
    // aritmética quebrá-la, o plano explode aqui e a transação aborta.
    nextStocks.push(validateStock({ ...draft, updatedAt: nowIso }));
  }
  return {
    nextStocks,
    nextTotalStockByProduct: state.totals,
    warnings: state.warnings,
  };
}

/**
 * Planeja o decremento de estoque dos itens de um pedido.
 *
 * Pré-condição: o chamador já validou os itens contra o catálogo (produto
 * existe/ativo, variante ativa, SKU) — `products` deve conter todos os
 * productIds dos itens. Linhas múltiplas do mesmo produto são agregadas (cada
 * linha enxerga o rascunho já decrementado pelas anteriores).
 *
 * Retorna `{ ok: false, insufficient }` com TODAS as faltas (não só a
 * primeira) para a UI listar os itens afetados de uma vez.
 */
export function planStockDecrement(
  items: readonly OrderItem[],
  products: ReadonlyMap<string, Product>,
  stocks: ReadonlyMap<string, Stock>,
  nowIso: string,
): StockDecrementResult {
  const state = createState();
  const insufficient: StockShortage[] = [];

  for (const item of items) {
    const product = products.get(item.productId);
    if (!product) {
      // Defensivo: a validação de catálogo do chamador deve ter barrado antes.
      state.warnings.push(
        `produto "${item.productId}" ausente do mapa de catálogo — item ignorado no plano de estoque`,
      );
      continue;
    }

    const draft = draftFor(state, stocks, item.productId);
    const total = currentTotal(state, product);

    if (!draft) {
      // Sem doc de stock: valida e movimenta apenas o totalStock denormalizado.
      state.warnings.push(
        `produto "${item.productId}" sem doc de stock — validando pelo product.totalStock`,
      );
      if (total < item.quantity) {
        insufficient.push(shortage(item, Math.max(0, total)));
        continue;
      }
      state.totals.set(item.productId, total - item.quantity);
      continue;
    }

    if (draft.hasVariants && !item.variantId) {
      // Drift: o stock rastreia variantes mas a linha do pedido não tem
      // variantId — impossível atribuir o decremento sem quebrar a invariante.
      state.warnings.push(
        `stock de "${item.productId}" rastreia variantes mas o item não tem variantId — caindo no product.totalStock`,
      );
      if (total < item.quantity) {
        insufficient.push(shortage(item, Math.max(0, total)));
        continue;
      }
      state.totals.set(item.productId, total - item.quantity);
      continue;
    }

    if (draft.hasVariants && item.variantId) {
      const available = draft.variants?.[item.variantId] ?? 0;
      if (available < item.quantity) {
        insufficient.push(shortage(item, available));
        continue;
      }
      draft.variants![item.variantId] = available - item.quantity;
      draft.quantity -= item.quantity;
    } else {
      // Doc simples (hasVariants=false): o pool é `quantity`, mesmo que a linha
      // tenha variantId (drift tolerado — o pool é compartilhado).
      if (draft.quantity < item.quantity) {
        insufficient.push(shortage(item, draft.quantity));
        continue;
      }
      draft.quantity -= item.quantity;
    }

    state.touched.add(item.productId);
    state.totals.set(item.productId, Math.max(0, total - item.quantity));
  }

  if (insufficient.length > 0) {
    return { ok: false, insufficient };
  }
  return { ok: true, ...finishPlan(state, nowIso) };
}

/**
 * Planeja a devolução do estoque de um pedido (pagamento falhou/cancelado ou
 * pedido cancelado). Simétrico ao decremento; nunca falha por falta — apenas
 * acumula `warnings` quando docs sumiram desde a criação do pedido (produto
 * deletado → Cloud Function apaga o stock; nesses casos não há o que devolver).
 *
 * O chamador é responsável por garantir idempotência via
 * `Order.stockMovement` ("decremented" → "released" exatamente uma vez).
 */
export function planStockRelease(
  items: readonly OrderItem[],
  products: ReadonlyMap<string, Product>,
  stocks: ReadonlyMap<string, Stock>,
  nowIso: string,
): StockMovementPlan {
  const state = createState();

  for (const item of items) {
    const product = products.get(item.productId) ?? null;
    const draft = draftFor(state, stocks, item.productId);

    if (product) {
      const total = currentTotal(state, product);
      state.totals.set(item.productId, total + item.quantity);
    } else {
      state.warnings.push(`produto "${item.productId}" não existe mais — totalStock não devolvido`);
    }

    if (!draft) {
      state.warnings.push(
        `produto "${item.productId}" sem doc de stock — devolução limitada ao totalStock`,
      );
      continue;
    }

    if (draft.hasVariants && !item.variantId) {
      state.warnings.push(
        `stock de "${item.productId}" rastreia variantes mas o item não tem variantId — devolução limitada ao totalStock`,
      );
      continue;
    }

    if (draft.hasVariants && item.variantId) {
      // Variante removida do mapa após a venda: re-criar a chave é inócuo e
      // mantém a invariante (quantity acompanha o incremento).
      draft.variants![item.variantId] = (draft.variants?.[item.variantId] ?? 0) + item.quantity;
      draft.quantity += item.quantity;
    } else {
      draft.quantity += item.quantity;
    }
    state.touched.add(item.productId);
  }

  return finishPlan(state, nowIso);
}

function shortage(item: OrderItem, available: number): StockShortage {
  return {
    productId: item.productId,
    ...(item.variantId ? { variantId: item.variantId } : {}),
    name: item.name,
    available,
    requested: item.quantity,
  };
}
