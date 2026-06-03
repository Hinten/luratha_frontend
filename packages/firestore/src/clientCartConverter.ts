/**
 * Firestore DataConverters for the Cart model — client SDK (firebase/firestore).
 */

import {
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import {
  type Cart,
  type CartItem,
  validateCart,
  validateCartItem,
  parseStrictWrite,
} from "@luratha/schemas";

function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export const clientCartConverter: FirestoreDataConverter<Cart> = {
  toFirestore(cart: Cart) {
    const { updatedAt, ...rest } = parseStrictWrite(validateCart, cart);
    return {
      ...rest,
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): Cart {
    const data = snapshot.data();
    return validateCart({
      ...data,
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};

export const clientCartItemConverter: FirestoreDataConverter<CartItem> = {
  toFirestore(item: CartItem) {
    const { addedAt, updatedAt, ...rest } = parseStrictWrite(validateCartItem, item);
    return {
      ...rest,
      addedAt: Timestamp.fromDate(new Date(addedAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): CartItem {
    const data = snapshot.data();
    return validateCartItem({
      ...data,
      addedAt: extractTimestamp(data.addedAt),
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};
