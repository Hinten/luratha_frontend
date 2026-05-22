/**
 * Firestore DataConverter for Address — client SDK (firebase/firestore).
 */

import {
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { type Address, validateAddress } from "@luratha/schemas";

function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export const clientAddressConverter: FirestoreDataConverter<Address> = {
  toFirestore(address: Address) {
    const { createdAt, updatedAt, ...rest } = address;
    return {
      ...rest,
      createdAt: Timestamp.fromDate(new Date(createdAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): Address {
    const data = snapshot.data();
    return validateAddress({
      ...data,
      createdAt: extractTimestamp(data.createdAt),
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};
