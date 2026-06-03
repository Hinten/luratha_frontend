/**
 * Firestore DataConverter for the Stock model — admin SDK (firebase-admin/firestore).
 *
 * Collection: "stock" (document id = productId). Converts `updatedAt` between an
 * ISO-8601 string and a Firestore Timestamp, and enforces the schema on write
 * (unknown top-level fields are rejected). Reads stay lenient: a legacy value
 * already stored as a plain string falls through unchanged.
 */

import { type FirestoreDataConverter, Timestamp } from "firebase-admin/firestore";
import { type Stock, validateStock, parseStrictWrite } from "@luratha/schemas";

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

export const adminStockConverter: FirestoreDataConverter<Stock> = {
  toFirestore(stock: Stock) {
    const { updatedAt, ...rest } = parseStrictWrite(validateStock, stock);
    return {
      ...rest,
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateStock({
      ...data,
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};
