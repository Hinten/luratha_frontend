/**
 * Firestore DataConverter for the Stock model — client SDK (firebase/firestore).
 *
 * Collection: "stock" (document id = productId). Converts `updatedAt` between an
 * ISO-8601 string and a Firestore Timestamp, and enforces the schema on write
 * (unknown top-level fields are rejected). Reads stay lenient: a legacy value
 * already stored as a plain string falls through unchanged.
 */

import {
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { type Stock, validateStock, parseStrictWrite } from "@luratha/schemas";

function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export const clientStockConverter: FirestoreDataConverter<Stock> = {
  toFirestore(stock: Stock) {
    const { updatedAt, ...rest } = parseStrictWrite(validateStock, stock);
    return {
      ...rest,
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): Stock {
    const data = snapshot.data();
    return validateStock({
      ...data,
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};
