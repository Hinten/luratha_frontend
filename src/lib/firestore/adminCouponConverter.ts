/**
 * Firestore DataConverter for the Coupon model — admin SDK (firebase-admin/firestore).
 *
 * Coupon timestamps are `startsAt` and `expiresAt` (validity window),
 * not creation/update timestamps.
 */

import { type FirestoreDataConverter, Timestamp } from "firebase-admin/firestore";
import { type Coupon, validateCoupon } from "@/src/schemas/firestore";

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

export const adminCouponConverter: FirestoreDataConverter<Coupon> = {
  toFirestore(coupon: Coupon) {
    const { startsAt, expiresAt, ...rest } = coupon;
    return {
      ...rest,
      startsAt: Timestamp.fromDate(new Date(startsAt)),
      expiresAt: Timestamp.fromDate(new Date(expiresAt)),
    };
  },

  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateCoupon({
      ...data,
      startsAt: extractTimestamp(data.startsAt),
      expiresAt: extractTimestamp(data.expiresAt),
    });
  },
};
