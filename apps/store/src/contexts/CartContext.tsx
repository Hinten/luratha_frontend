"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { ZodError } from "zod";
import { useAuth } from "@/src/contexts/AuthContext";
import { db } from "@luratha/firestore/firebaseClient";
import {
  clientCartConverter,
  clientCartItemConverter,
} from "@luratha/firestore/clientCartConverter";
import {
  buildCartItemId,
  type Cart,
  type CartItem,
  firestoreCollections,
  validateCart,
  validateCartItem,
} from "@luratha/schemas";
import { toCents } from "@luratha/schemas/utils";
import { ApiResponseError, throwIfNotOk } from "@/src/lib/errors";

/** Public payload accepted by `addItem`. Mirrors the server input schema. */
export interface CartItemInput {
  productId: string;
  variantId?: string;
  variantSku: string;
  productSlug: string;
  name: string;
  photoId: string;
  imageUrl: string;
  variantLabel?: string;
  unitPrice: number;
  currency?: "BRL";
  quantity?: number;
}

interface CartState {
  items: CartItem[];
  cart: Cart;
  totalItems: number;
  totalPrice: number;
  /** Whether the provider has finished its initial hydration (localStorage or Firestore). */
  isReady: boolean;
  /** True while a write to the server is in flight. */
  isSyncing: boolean;
  /** Last error message from a write; consumers may surface it as a toast. */
  error: string | null;
  addItem: (input: CartItemInput) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartState | null>(null);

/** localStorage key. The `_v2` suffix invalidates the pre-variant schema. */
const STORAGE_KEY = "luratha_cart_v2";
const LEGACY_STORAGE_KEY = "luratha_cart";
/** Synthetic ids used when computing the cart shape for guest sessions. */
const GUEST_OWNER = "guestcart";

function emptyCart(userId: string): Cart {
  return validateCart({
    id: userId,
    userId,
    itemCount: 0,
    subtotal: 0,
    discountTotal: 0,
    shippingTotal: 0,
    grandTotal: 0,
    currency: "BRL",
    updatedAt: new Date().toISOString(),
  });
}

function computeLocalCart(userId: string, items: CartItem[]): Cart {
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotalCents = items.reduce(
    (sum, i) => sum + toCents(i.unitPrice) * i.quantity,
    0,
  );
  const subtotal = subtotalCents / 100;
  return validateCart({
    id: userId,
    userId,
    itemCount,
    subtotal,
    discountTotal: 0,
    shippingTotal: 0,
    grandTotal: Math.max(0, subtotal),
    currency: "BRL",
    updatedAt: new Date().toISOString(),
  });
}

function buildGuestItem(input: CartItemInput, previous?: CartItem): CartItem {
  const id = buildCartItemId(input.productId, input.variantId);
  const now = new Date().toISOString();
  const incomingQty = input.quantity ?? 1;
  const nextQuantity = previous ? previous.quantity + incomingQty : incomingQty;
  return validateCartItem({
    id,
    userId: GUEST_OWNER,
    productId: input.productId,
    variantId: input.variantId,
    variantSku: input.variantSku,
    productSlug: input.productSlug,
    name: input.name,
    photoId: input.photoId,
    imageUrl: input.imageUrl,
    variantLabel: input.variantLabel,
    unitPrice: input.unitPrice,
    quantity: nextQuantity,
    currency: input.currency ?? "BRL",
    addedAt: previous?.addedAt ?? now,
    updatedAt: now,
  });
}

/** Hydrate items from localStorage, discarding entries that don't pass the v2 schema. */
function hydrateGuestItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    if (err instanceof DOMException) {
      // Storage blocked (private mode, quota policy) — treat as empty cart.
      return [];
    }
    throw err;
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Corrupt payload — drop it; a fresh cart is recoverable from server on login.
      return [];
    }
    throw err;
  }
  if (!Array.isArray(parsed)) return [];

  const items: CartItem[] = [];
  for (const candidate of parsed) {
    try {
      items.push(validateCartItem(candidate));
    } catch (err) {
      if (!(err instanceof ZodError)) throw err;
      // Schema-mismatch — drop just this entry. The rest of the cart survives.
    }
  }
  return items;
}

function persistGuestItems(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    if (err instanceof DOMException) {
      // Storage full or blocked — server cart will own this on next login.
      return;
    }
    throw err;
  }
}

function clearLegacyStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (err) {
    if (err instanceof DOMException) return;
    throw err;
  }
}

/** Map a CartItem back to the input shape the server merge endpoint expects. */
function itemToInput(item: CartItem): CartItemInput {
  return {
    productId: item.productId,
    variantId: item.variantId,
    variantSku: item.variantSku,
    productSlug: item.productSlug,
    name: item.name,
    photoId: item.photoId,
    imageUrl: item.imageUrl,
    variantLabel: item.variantLabel,
    unitPrice: item.unitPrice,
    currency: item.currency,
    quantity: item.quantity,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const ownerKey = userId ?? GUEST_OWNER;

  const [items, setItems] = useState<CartItem[]>([]);
  const [cart, setCart] = useState<Cart>(() => emptyCart(GUEST_OWNER));
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Tracks the uid we last merged from localStorage, so we don't re-merge on every re-render. */
  const lastMergedFor = useRef<string | null>(null);

  // --- Hydration & subscription -------------------------------------------
  useEffect(() => {
    clearLegacyStorage();

    if (!userId) {
      const guestItems = hydrateGuestItems();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(guestItems);
      setCart(computeLocalCart(GUEST_OWNER, guestItems));
      setIsReady(true);
      return;
    }

    // Logged-in mode: server is authoritative. Subscribe to both the cart
    // document (totals) and the items subcollection (rows) so updates from
    // another device propagate live.
    setIsReady(false);

    const cartRef = doc(db, firestoreCollections.carts, userId).withConverter(
      clientCartConverter,
    );
    const itemsRef = collection(
      db,
      firestoreCollections.carts,
      userId,
      firestoreCollections.cartItems,
    ).withConverter(clientCartItemConverter);

    let cartReady = false;
    let itemsReady = false;
    const maybeReady = () => {
      if (cartReady && itemsReady) setIsReady(true);
    };

    const unsubCart = onSnapshot(
      cartRef,
      (snap) => {
        const data = snap.data();
        setCart(data ?? emptyCart(userId));
        cartReady = true;
        maybeReady();
      },
      () => {
        cartReady = true;
        maybeReady();
      },
    );
    const unsubItems = onSnapshot(
      itemsRef,
      (snap) => {
        const rows = snap.docs.map((d) => d.data());
        setItems(rows);
        itemsReady = true;
        maybeReady();
      },
      () => {
        itemsReady = true;
        maybeReady();
      },
    );

    return () => {
      unsubCart();
      unsubItems();
    };
  }, [userId]);

  // --- Guest → logged transition: merge localStorage into server cart ----
  useEffect(() => {
    if (!userId) {
      // Logged out: any merge tracking from a previous session is reset so
      // a future login merges its own pending items.
      lastMergedFor.current = null;
      return;
    }
    if (lastMergedFor.current === userId) return;
    lastMergedFor.current = userId;

    const pending = hydrateGuestItems();
    if (pending.length === 0) {
      persistGuestItems([]);
      return;
    }

    void (async () => {
      try {
        setIsSyncing(true);
        const response = await fetch("/api/cart/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: pending.map(itemToInput) }),
        });
        await throwIfNotOk(response, "Falha ao mesclar carrinho.");
        // Snapshot listener will update state. Clear localStorage either way.
        persistGuestItems([]);
      } catch (err) {
        if (!(err instanceof ApiResponseError)) throw err;
        setError(err.message);
      } finally {
        setIsSyncing(false);
      }
    })();
  }, [userId]);

  // --- Guest mutation helpers --------------------------------------------
  /**
   * Functional update used by every guest-mode action. Recomputes the cart
   * totals and persists to localStorage inside the same setter, so back-to-back
   * synchronous calls (e.g. add x3) see the latest items without closure drift.
   */
  const updateGuestItems = useCallback(
    (transform: (prev: CartItem[]) => CartItem[]) => {
      setItems((prev) => {
        const next = transform(prev);
        setCart(computeLocalCart(GUEST_OWNER, next));
        persistGuestItems(next);
        return next;
      });
    },
    [],
  );

  // --- Public actions -----------------------------------------------------
  const addItem = useCallback(
    async (input: CartItemInput) => {
      setError(null);
      if (!userId) {
        // Eagerly validate the input *outside* the setter so a Zod failure
        // rejects the returned Promise instead of getting swallowed by React's
        // updater scheduling.
        const validatedFresh = buildGuestItem(input);
        const id = buildCartItemId(input.productId, input.variantId);
        updateGuestItems((prev) => {
          const existing = prev.find((i) => i.id === id);
          if (existing) {
            return prev.map((i) =>
              i.id === id ? buildGuestItem(input, existing) : i,
            );
          }
          return [...prev, validatedFresh];
        });
        return;
      }
      try {
        setIsSyncing(true);
        const response = await fetch("/api/cart/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currency: "BRL",
            quantity: 1,
            ...input,
          }),
        });
        await throwIfNotOk(response, "Falha ao adicionar ao carrinho.");
      } catch (err) {
        if (!(err instanceof ApiResponseError)) throw err;
        setError(err.message);
      } finally {
        setIsSyncing(false);
      }
    },
    [updateGuestItems, userId],
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      setError(null);
      if (!Number.isInteger(quantity)) return;
      if (!userId) {
        updateGuestItems((prev) => {
          if (quantity <= 0) return prev.filter((i) => i.id !== itemId);
          return prev.map((i) =>
            i.id === itemId
              ? validateCartItem({
                  ...i,
                  quantity,
                  updatedAt: new Date().toISOString(),
                })
              : i,
          );
        });
        return;
      }
      try {
        setIsSyncing(true);
        const response = await fetch(
          `/api/cart/items/${encodeURIComponent(itemId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity }),
          },
        );
        await throwIfNotOk(response, "Falha ao atualizar item.");
      } catch (err) {
        if (!(err instanceof ApiResponseError)) throw err;
        setError(err.message);
      } finally {
        setIsSyncing(false);
      }
    },
    [updateGuestItems, userId],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      setError(null);
      if (!userId) {
        updateGuestItems((prev) => prev.filter((i) => i.id !== itemId));
        return;
      }
      try {
        setIsSyncing(true);
        const response = await fetch(
          `/api/cart/items/${encodeURIComponent(itemId)}`,
          { method: "DELETE" },
        );
        // 404 means the item was already gone — treat as success.
        if (response.status === 404) return;
        await throwIfNotOk(response, "Falha ao remover item.");
      } catch (err) {
        if (!(err instanceof ApiResponseError)) throw err;
        setError(err.message);
      } finally {
        setIsSyncing(false);
      }
    },
    [updateGuestItems, userId],
  );

  const clearCart = useCallback(async () => {
    setError(null);
    if (!userId) {
      updateGuestItems(() => []);
      return;
    }
    try {
      setIsSyncing(true);
      const response = await fetch("/api/cart", { method: "DELETE" });
      // 204 (idempotent wipe) and 404 (already empty) both mean success.
      if (response.status === 204 || response.status === 404) return;
      await throwIfNotOk(response, "Falha ao limpar o carrinho.");
    } catch (err) {
      if (!(err instanceof ApiResponseError)) throw err;
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  }, [updateGuestItems, userId]);

  const totalItems = cart.itemCount;
  const totalPrice = cart.subtotal;

  return (
    <CartContext.Provider
      value={{
        items,
        cart: cart.userId === ownerKey ? cart : emptyCart(ownerKey),
        totalItems,
        totalPrice,
        isReady,
        isSyncing,
        error,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
