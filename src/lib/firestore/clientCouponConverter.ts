/**
 * Firestore DataConverter for the Coupon model — client SDK (firebase/firestore).
 *
 * Coupon timestamps are `startsAt` and `expiresAt` (validity window),
 * not creation/update timestamps.
 */

import {
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { type Coupon, validateCoupon } from "@/src/schemas/firestore";

function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export const clientCouponConverter: FirestoreDataConverter<Coupon> = {
  toFirestore(coupon: Coupon) {
    const { startsAt, expiresAt, ...rest } = coupon;
    return {
      ...rest,
      startsAt: Timestamp.fromDate(new Date(startsAt)),
      expiresAt: Timestamp.fromDate(new Date(expiresAt)),
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): Coupon {
    const data = snapshot.data();
    return validateCoupon({
      ...data,
      startsAt: extractTimestamp(data.startsAt),
      expiresAt: extractTimestamp(data.expiresAt),
    });
  },
};
