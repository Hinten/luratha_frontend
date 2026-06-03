/**
 * Firestore DataConverter for the Order model — client SDK (firebase/firestore).
 */

import {
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { type Order, validateOrder, parseStrictWrite } from "@luratha/schemas";

function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export const clientOrderConverter: FirestoreDataConverter<Order> = {
  toFirestore(order: Order) {
    // Re-validate the outgoing bytes and HARD-FAIL on any unrecognized top-level
    // field. Reads are unaffected (fromFirestore below is unchanged).
    const { createdAt, updatedAt, ...rest } = parseStrictWrite(validateOrder, order);
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
