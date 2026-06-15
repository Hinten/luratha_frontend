import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";

// --- Module mocks ----------------------------------------------------------
// Logged-in mode: AuthContext returns a uid, so CartProvider takes the server
// path. onSnapshot is a no-op (never fires) — items/serverItemsRef stay [],
// which is exactly the authoritative state we roll back to on a failed sync.

vi.mock("@/src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "user-1", email: "u@test.luratha" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    sendPasswordReset: vi.fn(),
  }),
}));

vi.mock("@luratha/firestore/firebaseClient", () => ({
  db: {},
  storage: {},
  getClientAuth: () => ({}),
}));

// Captura o callback de sucesso do onSnapshot de *items* para podermos
// disparar snapshots manualmente nos testes de gating/reconciliação.
const snap = vi.hoisted(() => ({ itemsCb: null as null | ((s: unknown) => void) }));

vi.mock("firebase/firestore", () => ({
  // Refs precisam de `.withConverter()`; devolvemos ids distinguíveis para o
  // onSnapshot saber qual subscription é a de items.
  collection: vi.fn(() => ({ withConverter: () => "itemsRef" })),
  doc: vi.fn(() => ({ withConverter: () => "cartRef" })),
  onSnapshot: vi.fn((ref: unknown, cb: (s: unknown) => void) => {
    if (ref === "itemsRef") snap.itemsCb = cb;
    return () => undefined;
  }),
  Timestamp: { fromDate: (d: Date) => ({ toDate: () => d }) },
}));

/** Dispara um snapshot de items com as linhas dadas (cada uma vira `data()`). */
function emitItems(rows: unknown[]) {
  snap.itemsCb?.({ docs: rows.map((r) => ({ data: () => r })) });
}

vi.mock("@luratha/firestore/clientCartConverter", () => ({
  clientCartConverter: {},
  clientCartItemConverter: {},
}));

import { CartProvider, useCart, type CartItemInput } from "@/src/contexts/CartContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

const baseItem: CartItemInput = {
  productId: "prod-1",
  variantId: "var-m",
  variantSku: "SKU-001",
  productSlug: "vestido-bordado-sku-001",
  name: "Vestido Bordado Floral",
  photoId: "photo-1",
  imageUrl: "https://example.com/img/vestido.jpg",
  variantLabel: "M",
  unitPrice: 389,
  currency: "BRL",
  quantity: 1,
};
const itemId = `${baseItem.productId}__${baseItem.variantId}`;

describe("CartContext (logged-in, otimista)", () => {
  beforeEach(() => {
    localStorage.clear();
    snap.itemsCb = null;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("addItem atualiza o carrinho na hora, antes do fetch resolver", async () => {
    // fetch que nunca resolve: prova que o update não espera o round-trip.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.totalPrice).toBe(389);
    // Sync segue pendente em background.
    expect(result.current.isSyncing).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/cart/items",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("reverte (rollback) e expõe o erro quando o sync em background falha", async () => {
    // fetch deferido: resolvemos manualmente DEPOIS de observar o estado
    // otimista — senão o act() libera o microtask do rollback junto.
    let resolveFetch!: (r: Response) => void;
    const pending = new Promise<Response>((res) => {
      resolveFetch = res;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending),
    );
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
    });
    // Update otimista aplicado imediatamente, com o POST ainda pendente.
    expect(result.current.items).toHaveLength(1);
    expect(result.current.isSyncing).toBe(true);

    // Servidor responde 409 → rollback para o snapshot autoritativo ([]).
    await act(async () => {
      resolveFetch({
        ok: false,
        status: 409,
        json: async () => ({ message: "Produto esgotado.", code: "out_of_stock" }),
      } as Response);
      await pending.catch(() => undefined);
    });

    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(result.current.error).toBe("Produto esgotado.");
    expect(result.current.isSyncing).toBe(false);
  });

  it("removeItem remove na hora e reverte se o DELETE falhar", async () => {
    // 1º: add otimista com sync que nunca resolve (item fica visível).
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const { result } = renderHook(() => useCart(), { wrapper });
    await act(async () => {
      await result.current.addItem(baseItem);
    });
    expect(result.current.items).toHaveLength(1);

    // 2º: remove com DELETE que falha → some na hora, volta no rollback.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ message: "Falha." }),
      })),
    );
    await act(async () => {
      await result.current.removeItem(itemId);
    });
    expect(result.current.items).toHaveLength(0);

    // serverItemsRef ainda é [] (onSnapshot nunca trouxe o item), então o
    // rollback do remove mantém o carrinho vazio — coerente com a verdade
    // do servidor.
    await waitFor(() => expect(result.current.error).toBe("Falha."));
  });

  it("snapshot intermediário NÃO sobrescreve o estado otimista durante o write", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const { result } = renderHook(() => useCart(), { wrapper });
    await act(async () => {
      await result.current.addItem(baseItem);
    });
    expect(result.current.items).toHaveLength(1);

    // Snapshot intermediário (servidor ainda sem o item) chega durante o write
    // em voo — deve ser ignorado para não reverter a UI otimista.
    act(() => emitItems([]));
    expect(result.current.items).toHaveLength(1);
  });

  it("reconcilia com o snapshot pós-commit quando o write settla (gate libera)", async () => {
    let resolveFetch!: (r: Response) => void;
    const pending = new Promise<Response>((res) => {
      resolveFetch = res;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending),
    );
    const { result } = renderHook(() => useCart(), { wrapper });
    await act(async () => {
      await result.current.addItem(baseItem);
    });

    // Gated durante o write.
    act(() => emitItems([]));
    expect(result.current.items).toHaveLength(1);

    // Write conclui (sucesso) → optimisticWrites volta a 0, gate libera.
    await act(async () => {
      resolveFetch({ ok: true, status: 200, json: async () => ({}) } as Response);
      await pending.catch(() => undefined);
    });

    // Snapshot pós-commit (qty autoritativa = 5) agora aplica.
    act(() => emitItems([{ id: itemId, productId: "prod-1", variantId: "var-m", quantity: 5 }]));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(5);
  });
});
