/**
 * Firestore DataConverter para o documento `settings/global` — admin SDK.
 */

import { type FirestoreDataConverter, Timestamp } from "firebase-admin/firestore";
import { type SiteSettings, validateSiteSettings, parseStrictWrite } from "@luratha/schemas";

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

export const adminSiteSettingsConverter: FirestoreDataConverter<SiteSettings> = {
  toFirestore(settings: SiteSettings) {
    const { updatedAt, ...rest } = parseStrictWrite(validateSiteSettings, settings);
    return {
      ...rest,
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
    };
  },

  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateSiteSettings({
      ...data,
      id: snapshot.id,
      updatedAt: extractTimestamp(data.updatedAt),
    });
  },
};
