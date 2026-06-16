"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
// eslint-disable-next-line no-restricted-imports -- realtime cart listener: repositories expose one-shot reads only, not onSnapshot. The refs built below are converter-bound (clientCartConverter / clientCartItemConverter), so these reads stay schema-validated.
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
import { trackAddToCart, trackRemoveFromCart } from "@/src/lib/analytics/ecommerce";
import { logger } from "@luratha/core/logging/logger";

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
/**
 * UUID gerado uma vez por "sessão de guest cart" (criado quando o 1º item
 * entra no localStorage). Enviado pro `/api/cart/merge`; o servidor usa pra
 * deduplicar merges repetidos da mesma leva (reload, multi-tab, Strict Mode).
 */
const GUEST_TOKEN_KEY = "luratha_cart_v2_token";
/**
 * Marker `{token, uid}` gravado após um merge bem-sucedido. Permite que o
 * cliente pule a chamada se o token pendente já foi mesclado pro mesmo uid
 * — defesa adicional caso `persistGuestItems([])` falhe silenciosamente.
 */
const LAST_MERGED_KEY = "luratha_cart_v2_last_merged";
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
  const subtotalCents = items.reduce((sum, i) => sum + toCents(i.unitPrice) * i.quantity, 0);
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

function buildLocalItem(input: CartItemInput, owner: string, previous?: CartItem): CartItem {
  const id = buildCartItemId(input.productId, input.variantId);
  const now = new Date().toISOString();
  const incomingQty = input.quantity ?? 1;
  const nextQuantity = previous ? previous.quantity + incomingQty : incomingQty;
  return validateCartItem({
    id,
    userId: owner,
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

function readGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(GUEST_TOKEN_KEY);
  } catch (err) {
    if (err instanceof DOMException) return null;
    throw err;
  }
}

function writeGuestToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUEST_TOKEN_KEY, token);
  } catch (err) {
    if (err instanceof DOMException) return;
    throw err;
  }
}

function clearGuestToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GUEST_TOKEN_KEY);
  } catch (err) {
    if (err instanceof DOMException) return;
    throw err;
  }
}

/**
 * Garante que existe um UUID associado à leva atual de itens guest. Gera
 * um novo no 1º item; reusa o existente em items subsequentes da mesma sessão.
 */
function ensureGuestToken(): string {
  const existing = readGuestToken();
  if (existing) return existing;
  const token =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : // Fallback minimalista pra ambientes sem crypto.randomUUID (Node antigo).
        `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  writeGuestToken(token);
  return token;
}

interface LastMergedMarker {
  token: string;
  uid: string;
}

function readLastMerged(): LastMergedMarker | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(LAST_MERGED_KEY);
  } catch (err) {
    if (err instanceof DOMException) return null;
    throw err;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "token" in parsed &&
      "uid" in parsed &&
      typeof (parsed as { token: unknown }).token === "string" &&
      typeof (parsed as { uid: unknown }).uid === "string"
    ) {
      return parsed as LastMergedMarker;
    }
    return null;
  } catch (err) {
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}

function writeLastMerged(marker: LastMergedMarker): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_MERGED_KEY, JSON.stringify(marker));
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

  /**
   * Tracks the uid we already kicked off a merge for. Prevents the merge from
   * double-firing in React strict mode (where the effect mounts twice) and
   * during transient userId churn.
   */
  const lastMergedFor = useRef<string | null>(null);

  // Espelha `items` num ref para o `removeItem` montar o payload de
  // `remove_from_cart` (nome/preço/quantidade) sem entrar nas deps do callback.
  // Nome distinto do `itemsRef` (collection ref do Firestore) usado no effect
  // de hidratação abaixo, para evitar shadowing.
  const latestItemsRef = useRef<CartItem[]>(items);
  useEffect(() => {
    latestItemsRef.current = items;
  }, [items]);

  /**
   * Último estado autoritativo vindo do `onSnapshot` (modo logado). As mutações
   * otimistas atualizam `items` na hora e sincronizam em background; se o POST
   * falhar, revertemos `items` para este snapshot (o POST falho não escreveu
   * nada, então ele é a verdade atual).
   */
  const serverItemsRef = useRef<CartItem[]>([]);
  /**
   * Contador de escritas em voo. `isSyncing` reflete "há sync pendente" sem que
   * uma operação concorrente que termina antes zere o flag de outra ainda ativa
   * (o boolean simples tinha essa corrida). Mantém o gate do botão "Finalizar
   * Compra" correto mesmo com vários adds otimistas em paralelo.
   */
  const syncCount = useRef(0);
  /**
   * Contador só das **mutações otimistas** em voo (add/update/remove/clear no
   * modo logado) — distinto de `syncCount`, que também conta o merge. Os
   * callbacks do `onSnapshot` usam este para NÃO sobrescrever o estado otimista
   * enquanto há writes do usuário pendentes. O merge (server-authoritative) não
   * incrementa, então seus snapshots aplicam normalmente (evita a corrida do
   * login→checkout, em que `items` ficaria defasado no instante do `isReady`).
   */
  const optimisticWrites = useRef(0);

  const beginSync = useCallback(() => {
    syncCount.current += 1;
    setIsSyncing(true);
  }, []);
  const endSync = useCallback(() => {
    syncCount.current = Math.max(0, syncCount.current - 1);
    if (syncCount.current === 0) setIsSyncing(false);
  }, []);

  // --- Hydration, subscription, and guest→logged merge --------------------
  //
  // Single effect coordinates both halves of the login transition so that
  // `isReady` only flips to `true` once the Firestore snapshots have arrived
  // AND the `/api/cart/merge` upload finished. Splitting these into two
  // effects (the previous shape) left a race where the snapshot for a brand-
  // new logged-in user returned an empty cart, set `isReady=true`, and any
  // page guarding on `cartReady && items.length === 0` (e.g. /checkout) would
  // redirect away before the localStorage merge committed.
  useEffect(() => {
    clearLegacyStorage();

    if (!userId) {
      const guestItems = hydrateGuestItems();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(guestItems);
      setCart(computeLocalCart(GUEST_OWNER, guestItems));
      setIsReady(true);
      // Reset merge tracking so a future login re-merges fresh guest items.
      lastMergedFor.current = null;
      return;
    }

    // Logged-in mode: server is authoritative.
    setIsReady(false);
    // Zera o snapshot de rollback até o primeiro `onSnapshot` chegar.
    serverItemsRef.current = [];

    // Read pending guest items synchronously, BEFORE subscribing or merging,
    // so a slow Firestore snapshot can't race with localStorage being cleared.
    const pending = lastMergedFor.current === userId ? [] : hydrateGuestItems();
    const pendingToken = readGuestToken();
    const lastMerged = readLastMerged();
    // Skip o merge se essa leva (mesmo token) já foi mesclada pra esse uid.
    // Sobrevive a reload, multi-tab, hot-reload em dev e até falhas
    // silenciosas de `persistGuestItems([])`. O ref `lastMergedFor` cobre
    // o caso "mesma instância em vida"; esta checagem cobre "across reloads".
    const alreadyMerged =
      pendingToken !== null &&
      lastMerged !== null &&
      lastMerged.token === pendingToken &&
      lastMerged.uid === userId;
    const needsMerge = pending.length > 0 && pendingToken !== null && !alreadyMerged;
    if (needsMerge) {
      lastMergedFor.current = userId;
    }

    let cancelled = false;
    let cartReady = false;
    let itemsReady = false;
    let snapshotsReady = false;
    let mergeDone = !needsMerge;

    const maybeReady = () => {
      if (cancelled) return;
      if (snapshotsReady && mergeDone) setIsReady(true);
    };
    const checkSnapshots = () => {
      if (cartReady && itemsReady) {
        snapshotsReady = true;
        maybeReady();
      }
    };

    const cartRef = doc(db, firestoreCollections.carts, userId).withConverter(clientCartConverter);
    const itemsRef = collection(
      db,
      firestoreCollections.carts,
      userId,
      firestoreCollections.cartItems,
    ).withConverter(clientCartItemConverter);

    const unsubCart = onSnapshot(
      cartRef,
      (snap) => {
        if (cancelled) return;
        const data = snap.data();
        // Não aplica enquanto há mutação otimista em voo — o estado otimista
        // (computeLocalCart) é a verdade até zerarem; o snapshot pós-commit
        // reconcilia. Ver o gate de `items` abaixo.
        if (optimisticWrites.current === 0) setCart(data ?? emptyCart(userId));
        cartReady = true;
        checkSnapshots();
      },
      () => {
        if (cancelled) return;
        cartReady = true;
        checkSnapshots();
      },
    );
    const unsubItems = onSnapshot(
      itemsRef,
      (snap) => {
        if (cancelled) return;
        const rows = snap.docs.map((d) => d.data());
        // Verdade autoritativa para o rollback das mutações otimistas.
        serverItemsRef.current = rows;
        // Não sobrescreve o estado otimista enquanto há mutação otimista em
        // voo: um snapshot intermediário (ex.: commit do 1º de vários adds
        // rápidos) reverteria a UI para uma quantidade defasada até o próximo
        // snapshot. Ao zerar, o snapshot pós-commit reconcilia (e traz os
        // campos server-side, como `dimensions`).
        if (optimisticWrites.current === 0) setItems(rows);
        itemsReady = true;
        checkSnapshots();
      },
      () => {
        if (cancelled) return;
        itemsReady = true;
        checkSnapshots();
      },
    );

    if (needsMerge) {
      beginSync();
      void (async () => {
        try {
          const response = await fetch("/api/cart/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mergeToken: pendingToken,
              items: pending.map(itemToInput),
            }),
          });
          await throwIfNotOk(response, "Falha ao mesclar carrinho.");
          // ORDEM IMPORTA: grava o marker ANTES de limpar items/token. Se a
          // limpeza falhar (quota cheia, modo privado), o marker ainda
          // bloqueia re-merges da mesma leva no próximo mount.
          writeLastMerged({ token: pendingToken!, uid: userId });
          persistGuestItems([]);
          clearGuestToken();
        } catch (err) {
          if (!(err instanceof ApiResponseError)) throw err;
          // Silenciar: o merge roda em background. Falhas típicas são 401
          // transitório (cookie __session ainda não propagou ao server logo
          // após login) — não há nada que o usuário possa fazer. Vazar
          // "Não autenticado" no banner do /carrinho com o user logado é
          // confuso. Próxima ação de cart (addItem etc) re-tenta a sync.
          logger.warn("[cart] merge falhou (silencioso)", {
            status: err.status,
            message: err.message,
          });
        } finally {
          // mergeDone flips regardless of success — otherwise a merge failure
          // would leave `isReady` stuck on false forever and block the UI.
          mergeDone = true;
          endSync();
          maybeReady();
        }
      })();
    }

    return () => {
      cancelled = true;
      unsubCart();
      unsubItems();
    };
  }, [userId, beginSync, endSync]);

  // --- Guest mutation helpers --------------------------------------------
  /**
   * Functional update used by every guest-mode action. Recomputes the cart
   * totals and persists to localStorage inside the same setter, so back-to-back
   * synchronous calls (e.g. add x3) see the latest items without closure drift.
   */
  const updateGuestItems = useCallback((transform: (prev: CartItem[]) => CartItem[]) => {
    setItems((prev) => {
      const next = transform(prev);
      setCart(computeLocalCart(GUEST_OWNER, next));
      persistGuestItems(next);
      // Token vive enquanto houver items pendentes pra mesclar. Limpa quando
      // o carrinho fica vazio (sem o que mesclar = sem precisar de token).
      if (next.length > 0) {
        ensureGuestToken();
      } else {
        clearGuestToken();
      }
      return next;
    });
  }, []);

  // --- Optimistic logged-in helpers --------------------------------------
  /**
   * Atualiza `items`/`cart` localmente na hora (modo logado). O `onSnapshot`
   * reconcilia com a verdade do servidor quando o write commita.
   */
  const applyOptimistic = useCallback(
    (uid: string, transform: (prev: CartItem[]) => CartItem[]) => {
      setItems((prev) => {
        const next = transform(prev);
        setCart(computeLocalCart(uid, next));
        return next;
      });
    },
    [],
  );

  /** Reverte para o último snapshot autoritativo após um write falho. */
  const rollback = useCallback((uid: string, message: string) => {
    setItems(serverItemsRef.current);
    setCart(computeLocalCart(uid, serverItemsRef.current));
    setError(message);
  }, []);

  /**
   * Dispara o write no servidor em background (sem bloquear o clique). Sucesso
   * → o `onSnapshot` reconcilia. Falha (`ApiResponseError`/`TypeError`) →
   * rollback para o snapshot autoritativo + mensagem. `okStatuses` cobre
   * respostas idempotentes (204/404) que não são erro.
   */
  const syncInBackground = useCallback(
    (uid: string, run: () => Promise<Response>, fallbackMsg: string, okStatuses: number[] = []) => {
      void (async () => {
        // Trava os snapshots de sobrescreverem o estado otimista até o write
        // settlar; o snapshot pós-commit reconcilia quando voltar a 0.
        optimisticWrites.current += 1;
        beginSync();
        try {
          const response = await run();
          if (okStatuses.includes(response.status)) return;
          await throwIfNotOk(response, fallbackMsg);
        } catch (err) {
          if (err instanceof ApiResponseError) {
            rollback(uid, err.message);
            return;
          }
          if (err instanceof TypeError) {
            // Queda de conexão — o POST não chegou ao servidor.
            rollback(uid, "Falha de conexão ao sincronizar o carrinho. Tente novamente.");
            return;
          }
          throw err;
        } finally {
          optimisticWrites.current = Math.max(0, optimisticWrites.current - 1);
          endSync();
        }
      })();
    },
    [beginSync, endSync, rollback],
  );

  // --- Public actions -----------------------------------------------------
  const addItem = useCallback(
    async (input: CartItemInput) => {
      setError(null);
      // Validar o input *fora* do setter para que um erro de schema rejeite a
      // Promise (em vez de ser engolido pelo scheduling do updater do React).
      const id = buildCartItemId(input.productId, input.variantId);
      if (!userId) {
        const validatedFresh = buildLocalItem(input, GUEST_OWNER);
        updateGuestItems((prev) => {
          const existing = prev.find((i) => i.id === id);
          if (existing) {
            return prev.map((i) =>
              i.id === id ? buildLocalItem(input, GUEST_OWNER, existing) : i,
            );
          }
          return [...prev, validatedFresh];
        });
        trackAddToCart(input);
        return;
      }
      // Logado: atualiza local na hora (otimista) e sincroniza em background —
      // o botão não espera o round-trip. `buildLocalItem` valida o payload já.
      const fresh = buildLocalItem(input, userId);
      applyOptimistic(userId, (prev) => {
        const existing = prev.find((i) => i.id === id);
        if (existing) {
          return prev.map((i) => (i.id === id ? buildLocalItem(input, userId, existing) : i));
        }
        return [...prev, fresh];
      });
      syncInBackground(
        userId,
        () =>
          fetch("/api/cart/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currency: "BRL", quantity: 1, ...input }),
          }),
        "Falha ao adicionar ao carrinho.",
      );
      trackAddToCart(input);
    },
    [applyOptimistic, syncInBackground, updateGuestItems, userId],
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      setError(null);
      if (!Number.isInteger(quantity)) return;
      const transform = (prev: CartItem[]): CartItem[] => {
        if (quantity <= 0) return prev.filter((i) => i.id !== itemId);
        return prev.map((i) =>
          i.id === itemId
            ? validateCartItem({ ...i, quantity, updatedAt: new Date().toISOString() })
            : i,
        );
      };
      if (!userId) {
        updateGuestItems(transform);
        return;
      }
      applyOptimistic(userId, transform);
      syncInBackground(
        userId,
        () =>
          fetch(`/api/cart/items/${encodeURIComponent(itemId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity }),
          }),
        "Falha ao atualizar item.",
      );
    },
    [applyOptimistic, syncInBackground, updateGuestItems, userId],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      setError(null);
      const removed = latestItemsRef.current.find((i) => i.id === itemId);
      if (!userId) {
        updateGuestItems((prev) => prev.filter((i) => i.id !== itemId));
        if (removed) trackRemoveFromCart(removed);
        return;
      }
      applyOptimistic(userId, (prev) => prev.filter((i) => i.id !== itemId));
      syncInBackground(
        userId,
        () => fetch(`/api/cart/items/${encodeURIComponent(itemId)}`, { method: "DELETE" }),
        "Falha ao remover item.",
        // 404 = item já tinha sumido; trata como sucesso.
        [404],
      );
      if (removed) trackRemoveFromCart(removed);
    },
    [applyOptimistic, syncInBackground, updateGuestItems, userId],
  );

  const clearCart = useCallback(async () => {
    setError(null);
    if (!userId) {
      updateGuestItems(() => []);
      return;
    }
    applyOptimistic(userId, () => []);
    syncInBackground(
      userId,
      () => fetch("/api/cart", { method: "DELETE" }),
      "Falha ao limpar o carrinho.",
      // 204 (wipe idempotente) e 404 (já vazio) = sucesso.
      [204, 404],
    );
  }, [applyOptimistic, syncInBackground, updateGuestItems, userId]);

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
