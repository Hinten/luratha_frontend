/**
 * Firestore DataConverter for the UserProfile model — client SDK (firebase/firestore).
 */

import {
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { type UserProfile, validateUserProfile } from "@/src/schemas/firestore";

function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export const clientUserProfileConverter: FirestoreDataConverter<UserProfile> = {
  toFirestore(profile: UserProfile) {
    const { createdAt, updatedAt, ...rest } = profile;
    return {
      ...rest,
      createdAt: Timestamp.fromDate(new Date(createdAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): UserProfile {
    const data = snapshot.data();
    return validateUserProfile({
      ...data,
      createdAt: extractTimestamp(data.createdAt),
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};
