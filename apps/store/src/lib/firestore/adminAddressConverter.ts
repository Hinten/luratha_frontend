/**
 * Firestore DataConverter for Address — admin SDK (firebase-admin/firestore).
 *
 * Endereços vivem em `userProfiles/{uid}/addresses/{addressId}`. Converte
 * createdAt/updatedAt entre string ISO-8601 e Timestamp.
 */

import { type FirestoreDataConverter, Timestamp } from "firebase-admin/firestore";
import { type Address, validateAddress } from "@/src/schemas/firestore";

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

export const adminAddressConverter: FirestoreDataConverter<Address> = {
  toFirestore(address: Address) {
    const { createdAt, updatedAt, ...rest } = address;
    return {
      ...rest,
      createdAt: Timestamp.fromDate(new Date(createdAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateAddress({
      ...data,
      createdAt: extractTimestamp(data.createdAt),
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};
