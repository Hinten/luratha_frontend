/**
 * Firestore DataConverter for the Order model — client SDK (firebase/firestore).
 */

import {
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { type Order, validateOrder } from "@luratha/schemas";

function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export const clientOrderConverter: FirestoreDataConverter<Order> = {
  toFirestore(order: Order) {
    const { createdAt, updatedAt, ...rest } = order;
    return {
      ...rest,
      createdAt: Timestamp.fromDate(new Date(createdAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): Order {
    const data = snapshot.data();
    return validateOrder({
      ...data,
      createdAt: extractTimestamp(data.createdAt),
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};
