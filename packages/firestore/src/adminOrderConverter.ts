/**
 * Firestore DataConverter for the Order model — admin SDK (firebase-admin/firestore).
 *
 * Usage:
 *   const orderRef = adminDb
 *     .collection(firestoreCollections.orders)
 *     .doc(id)
 *     .withConverter(adminOrderConverter);
 *
 *   await orderRef.set(validatedOrder);
 *   const data = (await orderRef.get()).data();
 */

import { type FirestoreDataConverter, Timestamp } from "firebase-admin/firestore";
import { type Order, validateOrder, parseStrictWrite } from "@luratha/schemas";

function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (
    typeof val === "object" &&
    val !== null &&
    "toDate" in val &&
    typeof (val as { toDate: unknown }).toDate === "function"
  ) {
    return (val as { toDate(): Date }).toDate().toISOString();
  }
  return val;
}

export const adminOrderConverter: FirestoreDataConverter<Order> = {
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

  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateOrder({
      ...data,
      createdAt: extractTimestamp(data.createdAt),
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};
