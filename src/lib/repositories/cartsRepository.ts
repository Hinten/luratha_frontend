import "server-only";
import type { Firestore as AdminFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  type Cart,
  type CartItem,
  buildCartItemId,
  cartItemSchema,
  firestoreCollections,
  validateCart,
  validateCartItem,
} from "@/src/schemas/firestore";
import { toCents } from "@/src/schemas/firestore/utils";
import {
  adminCartConverter,
  adminCartItemConverter,
} from "@/src/lib/firestore/adminCartConverter";

const MAX_QUANTITY_PER_ITEM = 99;
const MAX_DISTINCT_ITEMS = 50;

export type CartRepositoryErrorCode =
  | "validation"
  | "not_found"
  | "quantity_exceeded"
  | "too_many_items"
  | "unknown";

export class CartRepositoryError extends Error {
  readonly code: CartRepositoryErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: CartRepositoryErrorCode, cause?: unknown) {
    super(message);
    this.name = "CartRepositoryError";
    this.code = code;
    this.cause = cause;
  }
}

/** Payload aceito ao adicionar um item ao cart via API. */
export const cartItemInputSchema = z.object({
  productId: cartItemSchema.shape.productId,
  variantId: cartItemSchema.shape.variantId,
  variantSku: cartItemSchema.shape.variantSku,
  productSlug: cartItemSchema.shape.productSlug,
  name: cartItemSchema.shape.name,
  photoId: cartItemSchema.shape.photoId,
  imageUrl: cartItemSchema.shape.imageUrl,
  variantLabel: cartItemSchema.shape.variantLabel,
  unitPrice: cartItemSchema.shape.unitPrice,
  currency: cartItemSchema.shape.currency,
  quantity: cartItemSchema.shape.quantity,
});
export type CartItemInput = z.infer<typeof cartItemInputSchema>;

export interface CartSnapshot {
  cart: Cart;
  items: CartItem[];
}

export interface CartsRepository {
  getCart(userId: string): Promise<CartSnapshot>;
  addItem(userId: string, input: CartItemInput): Promise<CartSnapshot>;
  setItemQuantity(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartSnapshot>;
  removeItem(userId: string, itemId: string): Promise<CartSnapshot>;
  clear(userId: string): Promise<void>;
  mergeItems(userId: string, inputs: CartItemInput[]): Promise<CartSnapshot>;
}

export function createCartsRepository(adminDb: AdminFirestore): CartsRepository {
  function cartRef(userId: string) {
    return adminDb
      .collection(firestoreCollections.carts)
      .doc(userId)
      .withConverter(adminCartConverter);
  }

  function itemsCollection(userId: string) {
    return adminDb
      .collection(firestoreCollections.carts)
      .doc(userId)
      .collection(firestoreCollections.cartItems)
      .withConverter(adminCartItemConverter);
  }

  function emptyCart(userId: string, isoNow: string): Cart {
    return validateCart({
      id: userId,
      userId,
      itemCount: 0,
      subtotal: 0,
      discountTotal: 0,
      shippingTotal: 0,
      grandTotal: 0,
      currency: "BRL",
      updatedAt: isoNow,
    });
  }

  function computeTotals(items: CartItem[], isoNow: string, userId: string): Cart {
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotalCents = items.reduce(
      (sum, i) => sum + toCents(i.unitPrice) * i.quantity,
      0,
    );
    const subtotal = subtotalCents / 100;
    const grandTotal = Math.max(0, subtotal);
    return validateCart({
      id: userId,
      userId,
      itemCount,
      subtotal,
      discountTotal: 0,
      shippingTotal: 0,
      grandTotal,
      currency: "BRL",
      updatedAt: isoNow,
    });
  }

  async function readItems(userId: string): Promise<CartItem[]> {
    const snap = await itemsCollection(userId).get();
    return snap.docs.map((d) => d.data());
  }

  async function getCart(userId: string): Promise<CartSnapshot> {
    try {
      const [cartSnap, items] = await Promise.all([
        cartRef(userId).get(),
        readItems(userId),
      ]);
      const isoNow = new Date().toISOString();
      const cart = cartSnap.exists ? cartSnap.data()! : emptyCart(userId, isoNow);
      return { cart, items };
    } catch (error) {
      throw normalize(error, `read cart for user "${userId}"`);
    }
  }

  async function addItem(userId: string, input: CartItemInput): Promise<CartSnapshot> {
    try {
      const parsedInput = cartItemInputSchema.parse(input);
      if (parsedInput.quantity > MAX_QUANTITY_PER_ITEM) {
        throw new CartRepositoryError(
          `Quantity for a single item cannot exceed ${MAX_QUANTITY_PER_ITEM}.`,
          "quantity_exceeded",
        );
      }
      const itemId = buildCartItemId(parsedInput.productId, parsedInput.variantId);
      const isoNow = new Date().toISOString();

      return await adminDb.runTransaction(async (tx) => {
        const cartDocRef = cartRef(userId);
        const itemDocRef = itemsCollection(userId).doc(itemId);
        const allItemsSnap = await tx.get(itemsCollection(userId));
        const itemSnap = await tx.get(itemDocRef);

        const previousItems: CartItem[] = allItemsSnap.docs.map((d) => d.data());

        let updatedItem: CartItem;
        if (itemSnap.exists) {
          const existing = itemSnap.data()!;
          const nextQuantity = existing.quantity + parsedInput.quantity;
          if (nextQuantity > MAX_QUANTITY_PER_ITEM) {
            throw new CartRepositoryError(
              `Quantity for a single item cannot exceed ${MAX_QUANTITY_PER_ITEM}.`,
              "quantity_exceeded",
            );
          }
          updatedItem = validateCartItem({
            ...existing,
            ...parsedInput,
            id: itemId,
            userId,
            quantity: nextQuantity,
            addedAt: existing.addedAt,
            updatedAt: isoNow,
          });
        } else {
          if (previousItems.length >= MAX_DISTINCT_ITEMS) {
            throw new CartRepositoryError(
              `Cart cannot hold more than ${MAX_DISTINCT_ITEMS} distinct items.`,
              "too_many_items",
            );
          }
          updatedItem = validateCartItem({
            ...parsedInput,
            id: itemId,
            userId,
            addedAt: isoNow,
            updatedAt: isoNow,
          });
        }

        const nextItems = mergeIntoList(previousItems, updatedItem);
        const nextCart = computeTotals(nextItems, isoNow, userId);

        tx.set(itemDocRef, updatedItem);
        tx.set(cartDocRef, nextCart);
        return { cart: nextCart, items: nextItems };
      });
    } catch (error) {
      throw normalize(error, `add item to cart for user "${userId}"`);
    }
  }

  async function setItemQuantity(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartSnapshot> {
    try {
      if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
        throw new CartRepositoryError(
          "Quantity must be a finite integer.",
          "validation",
        );
      }

      if (quantity <= 0) {
        return removeItem(userId, itemId);
      }

      if (quantity > MAX_QUANTITY_PER_ITEM) {
        throw new CartRepositoryError(
          `Quantity for a single item cannot exceed ${MAX_QUANTITY_PER_ITEM}.`,
          "quantity_exceeded",
        );
      }

      const isoNow = new Date().toISOString();

      return await adminDb.runTransaction(async (tx) => {
        const itemDocRef = itemsCollection(userId).doc(itemId);
        const allItemsSnap = await tx.get(itemsCollection(userId));
        const itemSnap = await tx.get(itemDocRef);

        if (!itemSnap.exists) {
          throw new CartRepositoryError(
            `Cart item "${itemId}" not found for user "${userId}".`,
            "not_found",
          );
        }

        const existing = itemSnap.data()!;
        const updated = validateCartItem({
          ...existing,
          quantity,
          updatedAt: isoNow,
        });

        const previousItems = allItemsSnap.docs.map((d) => d.data());
        const nextItems = mergeIntoList(previousItems, updated);
        const nextCart = computeTotals(nextItems, isoNow, userId);

        tx.set(itemDocRef, updated);
        tx.set(cartRef(userId), nextCart);
        return { cart: nextCart, items: nextItems };
      });
    } catch (error) {
      throw normalize(error, `update item "${itemId}" for user "${userId}"`);
    }
  }

  async function removeItem(userId: string, itemId: string): Promise<CartSnapshot> {
    try {
      const isoNow = new Date().toISOString();

      return await adminDb.runTransaction(async (tx) => {
        const itemDocRef = itemsCollection(userId).doc(itemId);
        const allItemsSnap = await tx.get(itemsCollection(userId));
        const itemSnap = await tx.get(itemDocRef);

        if (!itemSnap.exists) {
          throw new CartRepositoryError(
            `Cart item "${itemId}" not found for user "${userId}".`,
            "not_found",
          );
        }

        const previousItems = allItemsSnap.docs
          .map((d) => d.data())
          .filter((i) => i.id !== itemId);
        const nextCart = computeTotals(previousItems, isoNow, userId);

        tx.delete(itemDocRef);
        tx.set(cartRef(userId), nextCart);
        return { cart: nextCart, items: previousItems };
      });
    } catch (error) {
      throw normalize(error, `remove item "${itemId}" for user "${userId}"`);
    }
  }

  async function clear(userId: string): Promise<void> {
    try {
      const itemsSnap = await itemsCollection(userId).get();
      const batch = adminDb.batch();
      for (const doc of itemsSnap.docs) {
        batch.delete(doc.ref);
      }
      batch.delete(cartRef(userId));
      await batch.commit();
    } catch (error) {
      throw normalize(error, `clear cart for user "${userId}"`);
    }
  }

  async function mergeItems(
    userId: string,
    inputs: CartItemInput[],
  ): Promise<CartSnapshot> {
    try {
      if (!Array.isArray(inputs) || inputs.length === 0) {
        return getCart(userId);
      }

      const parsedInputs = inputs.map((entry) => cartItemInputSchema.parse(entry));
      const isoNow = new Date().toISOString();

      return await adminDb.runTransaction(async (tx) => {
        const existingItemsSnap = await tx.get(itemsCollection(userId));
        const existingById = new Map<string, CartItem>();
        for (const doc of existingItemsSnap.docs) {
          const data = doc.data();
          existingById.set(data.id, data);
        }

        for (const input of parsedInputs) {
          const itemId = buildCartItemId(input.productId, input.variantId);
          const previous = existingById.get(itemId);
          const baseQty = previous?.quantity ?? 0;
          const cappedQuantity = Math.min(MAX_QUANTITY_PER_ITEM, baseQty + input.quantity);
          if (cappedQuantity <= 0) continue;

          const updated = validateCartItem({
            ...(previous ?? {}),
            ...input,
            id: itemId,
            userId,
            quantity: cappedQuantity,
            addedAt: previous?.addedAt ?? isoNow,
            updatedAt: isoNow,
          });
          existingById.set(itemId, updated);
        }

        const distinctIds = Array.from(existingById.keys()).slice(0, MAX_DISTINCT_ITEMS);
        const nextItems = distinctIds.map((id) => existingById.get(id)!);

        for (const item of nextItems) {
          tx.set(itemsCollection(userId).doc(item.id), item);
        }
        // Remove items that may have been pruned by the distinct cap.
        for (const doc of existingItemsSnap.docs) {
          if (!distinctIds.includes(doc.id)) {
            tx.delete(doc.ref);
          }
        }

        const nextCart = computeTotals(nextItems, isoNow, userId);
        tx.set(cartRef(userId), nextCart);
        return { cart: nextCart, items: nextItems };
      });
    } catch (error) {
      throw normalize(error, `merge items into cart for user "${userId}"`);
    }
  }

  return {
    getCart,
    addItem,
    setItemQuantity,
    removeItem,
    clear,
    mergeItems,
  };
}

function mergeIntoList(items: CartItem[], updated: CartItem): CartItem[] {
  const idx = items.findIndex((i) => i.id === updated.id);
  if (idx === -1) return [...items, updated];
  const next = [...items];
  next[idx] = updated;
  return next;
}

function normalize(error: unknown, action: string): CartRepositoryError {
  if (error instanceof CartRepositoryError) return error;
  if (error instanceof z.ZodError) {
    return new CartRepositoryError(
      `Validation failed while trying to ${action}.`,
      "validation",
      error,
    );
  }
  if (error instanceof Error) {
    return new CartRepositoryError(
      `Failed to ${action}: ${error.message}`,
      "unknown",
      error,
    );
  }
  return new CartRepositoryError(
    `Failed to ${action} due to an unknown error.`,
    "unknown",
    error,
  );
}

