/**
 * Firestore DataConverter for the Review model — admin SDK (firebase-admin/firestore).
 *
 * Collection: "reviews". Converts `createdAt`/`updatedAt` between ISO-8601 strings
 * and Firestore Timestamps and enforces the schema on write (unknown top-level
 * fields are rejected). Reads stay lenient.
 *
 * The reviews collection has no read/write path wired yet — this converter
 * completes the schema-bound coverage so the upcoming reviews feature writes
 * through validation from day one (use it as `.withConverter(adminReviewConverter)`).
 */

import { type FirestoreDataConverter, Timestamp } from "firebase-admin/firestore";
import { type Review, validateReview, parseStrictWrite } from "@luratha/schemas";

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

export const adminReviewConverter: FirestoreDataConverter<Review> = {
  toFirestore(review: Review) {
    const { createdAt, updatedAt, ...rest } = parseStrictWrite(validateReview, review);
    return {
      ...rest,
      createdAt: Timestamp.fromDate(new Date(createdAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateReview({
      ...data,
      createdAt: extractTimestamp(data.createdAt),
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};
