/**
 * Regression test para o race carrinho→login→checkout.
 *
 * Reproduz a transição guest→logged onde:
 *   1. usuário tem itens em localStorage (`luratha_cart_v2`)
 *   2. faz login
 *   3. snapshots Firestore retornam empty (cart novo no servidor)
 *   4. POST /api/cart/merge ainda está em flight
 *
 * `CartContext.isReady` deve ficar `false` enquanto o merge não terminar —
 * caso contrário o guard em `/checkout/page.tsx` redireciona para /carrinho
 * vendo `items.length === 0` antes do merge popular o cart.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render } from "@testing-library/react";
import React, { useEffect } from "react";

// --- Mocks ----------------------------------------------------------------

let mockUserId: string | null = null;

vi.mock("@/src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockUserId ? { uid: mockUserId, name: "Test", email: "t@t.io", isAdmin: false } : null,
    isAuthenticated: !!mockUserId,
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

vi.mock("@luratha/firestore/clientCartConverter", () => ({
  clientCartConverter: {},
  clientCartItemConverter: {},
}));

type SnapshotCb = (snap: { data?: () => unknown; docs?: { data: () => unknown }[] }) => void;
const snapshotCallbacks: SnapshotCb[] = [];

vi.mock("firebase/firestore", () => {
  const refStub = { withConverter: () => refStub };
  return {
    collection: vi.fn(() => refStub),
    doc: vi.fn(() => refStub),
    onSnapshot: vi.fn((_ref: unknown, onNext: SnapshotCb) => {
      snapshotCallbacks.push(onNext);
      return () => undefined;
    }),
    Timestamp: { fromDate: (d: Date) => ({ toDate: () => d }) },
  };
});

import { CartProvider, useCart } from "@/src/contexts/CartContext";

// --- Helpers --------------------------------------------------------------

const guestItem = {
  id: "prod-1__var-m",
  userId: "guestcart",
  productId: "prod-1",
  variantId: "var-m",
  variantSku: "SKU-001",
  productSlug: "vestido-bordado-sku-001",
  name: "Vestido",
  photoId: "photo-1",
  imageUrl: "https://example.com/img.jpg",
  variantLabel: "M",
  unitPrice: 100,
  quantity: 1,
  currency: "BRL" as const,
  addedAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function CartProbe({
  onReady,
}: {
  onReady: (snapshot: { isReady: boolean; isSyncing: boolean; itemCount: number }) => void;
}) {
  const { isReady, isSyncing, items } = useCart();
  useEffect(() => {
    onReady({ isReady, isSyncing, itemCount: items.length });
  }, [isReady, isSyncing, items.length, onReady]);
  return null;
}

describe("CartContext — guest→logged race", () => {
  beforeEach(() => {
    localStorage.clear();
    snapshotCallbacks.length = 0;
    mockUserId = null;
    vi.restoreAllMocks();
  });

  it("isReady stays false until BOTH snapshots and /api/cart/merge complete", async () => {
    // 1. Seed guest cart + token in localStorage (token simula sessão de guest
    //    cart criada quando o usuário adicionou o 1º item).
    localStorage.setItem("luratha_cart_v2", JSON.stringify([guestItem]));
    localStorage.setItem("luratha_cart_v2_token", "11111111-1111-1111-1111-111111111111");

    // 2. Capture the snapshots() of CartContext state across renders.
    const snapshots: Array<{ isReady: boolean; isSyncing: boolean; itemCount: number }> = [];

    // 3. Stub fetch to control when the merge resolves.
    let resolveMerge: (() => void) | null = null;
    const fetchMock = vi.fn(
      (url: string) =>
        new Promise<Response>((resolve) => {
          if (url === "/api/cart/merge") {
            resolveMerge = () =>
              resolve(
                new Response(JSON.stringify({ ok: true }), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                }),
              );
          } else {
            resolve(new Response("", { status: 200 }));
          }
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // 4. Render with userId already set (logged in). Effect runs and triggers
    //    the merge + the snapshot subscriptions.
    mockUserId = "user-abc";
    render(
      <CartProvider>
        <CartProbe onReady={(s) => snapshots.push(s)} />
      </CartProvider>,
    );

    // 5. Initially isReady=false (subscribing + merging).
    const initial = snapshots[snapshots.length - 1];
    expect(initial.isReady).toBe(false);

    // 6. Simulate both Firestore snapshots returning empty.
    expect(snapshotCallbacks.length).toBe(2);
    await act(async () => {
      // Cart doc snapshot — empty (no server cart yet).
      snapshotCallbacks[0]({ data: () => undefined });
      // Items collection snapshot — empty array.
      snapshotCallbacks[1]({ docs: [] });
    });

    // Snapshots are in, but merge is still pending → isReady must remain false.
    const afterSnapshots = snapshots[snapshots.length - 1];
    expect(afterSnapshots.isReady).toBe(false);
    expect(afterSnapshots.isSyncing).toBe(true);

    // 7. Resolve the merge fetch.
    expect(resolveMerge).not.toBeNull();
    await act(async () => {
      resolveMerge!();
      // Flush microtasks so React processes the state update from .finally.
      await Promise.resolve();
    });

    const afterMerge = snapshots[snapshots.length - 1];
    expect(afterMerge.isReady).toBe(true);
    expect(afterMerge.isSyncing).toBe(false);

    // 8. localStorage was cleared (items + token); lastMerged marker registrado.
    expect(localStorage.getItem("luratha_cart_v2")).toBe("[]");
    expect(localStorage.getItem("luratha_cart_v2_token")).toBeNull();
    expect(localStorage.getItem("luratha_cart_v2_last_merged")).toBe(
      JSON.stringify({
        token: "11111111-1111-1111-1111-111111111111",
        uid: "user-abc",
      }),
    );
  });

  it("skips /api/cart/merge quando lastMerged.token === pendingToken (reload-after-merge)", async () => {
    // Cenário: usuário fez merge anteriormente, recarregou a página. Mesmo
    // que localStorage ainda tenha items + token (ex.: persistGuestItems
    // falhou no run anterior), o marker lastMerged deve bloquear re-merge.
    const token = "22222222-2222-2222-2222-222222222222";
    localStorage.setItem("luratha_cart_v2", JSON.stringify([guestItem]));
    localStorage.setItem("luratha_cart_v2_token", token);
    localStorage.setItem(
      "luratha_cart_v2_last_merged",
      JSON.stringify({ token, uid: "user-skip" }),
    );

    const fetchMock = vi.fn((_url: string) => Promise.resolve(new Response("", { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    mockUserId = "user-skip";
    render(
      <CartProvider>
        <CartProbe onReady={() => undefined} />
      </CartProvider>,
    );

    // Snapshots ainda precisam resolver pra isReady virar true, mas o merge
    // NÃO é chamado.
    await act(async () => {
      snapshotCallbacks[0]({ data: () => undefined });
      snapshotCallbacks[1]({ docs: [] });
    });

    expect(fetchMock.mock.calls.find((c) => c[0] === "/api/cart/merge")).toBeUndefined();
  });

  it("guest with no pending items: isReady flips on snapshots alone (no merge call)", async () => {
    // No localStorage seed → no pending items.
    const snapshots: Array<{ isReady: boolean; isSyncing: boolean; itemCount: number }> = [];

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    mockUserId = "user-no-pending";
    render(
      <CartProvider>
        <CartProbe onReady={(s) => snapshots.push(s)} />
      </CartProvider>,
    );

    expect(snapshots[snapshots.length - 1].isReady).toBe(false);

    await act(async () => {
      snapshotCallbacks[0]({ data: () => undefined });
      snapshotCallbacks[1]({ docs: [] });
    });

    expect(snapshots[snapshots.length - 1].isReady).toBe(true);
    // merge should NOT have been called when there's no pending guest item.
    expect(fetchMock.mock.calls.find((c) => c[0] === "/api/cart/merge")).toBeUndefined();
  });
});
