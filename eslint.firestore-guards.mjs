/**
 * Shared ESLint guards that forbid constructing a raw, unvalidated Firestore
 * reference. The only sanctioned path to the database is a repository + a
 * schema-bound DataConverter (`.withConverter()`), so `toFirestore` can enforce
 * the schema on every write (see `@luratha/schemas/strictWrite`).
 *
 * Two stock rules, no custom plugin:
 *   - `no-restricted-imports` blocks the client SDK free functions
 *     (`collection`/`doc`/`collectionGroup` from `firebase/firestore`).
 *   - `no-restricted-syntax` blocks the admin SDK method-style refs
 *     (`adminDb.collection(...)` / `db.collectionGroup(...)`), anchored on the
 *     db identifier so chained `.doc(...)` and pipeline calls don't false-positive.
 *
 * Legitimate exceptions (the repository ref-builders, realtime listeners that
 * repositories don't offer, delete-only refs with no payload, dev seed
 * endpoints) opt out via a `files` override (whole sanctioned packages) or a
 * documented inline `// eslint-disable-next-line ... -- <reason>`.
 */

/** Selectors appended to each config's `no-restricted-syntax` array. */
export const firestoreSyntaxRestrictions = [
  {
    selector:
      "CallExpression[callee.property.name='collection'][callee.object.name=/^(adminDb|db|dbInstance)$/]",
    message:
      "Direct `<db>.collection(...)` is forbidden. Route writes through a repository + schema-bound DataConverter so every write is validated. For a legitimate read-only/delete ref, add a documented `// eslint-disable-next-line no-restricted-syntax -- <reason>`.",
  },
  {
    selector:
      "CallExpression[callee.property.name='collectionGroup'][callee.object.name=/^(adminDb|db|dbInstance)$/]",
    message:
      "Direct `<db>.collectionGroup(...)` is forbidden outside sanctioned ref-builders. Use a repository, or add a documented inline disable for a legitimate read.",
  },
];

/** `paths` entry for `no-restricted-imports` (client SDK free functions). */
export const firestoreImportRestriction = {
  name: "firebase/firestore",
  importNames: ["collection", "doc", "collectionGroup"],
  message:
    "Build Firestore refs only inside sanctioned modules (repository ref-builders / DataConverters). Use a repository function instead of `collection`/`doc`/`collectionGroup` directly, or add a documented `// eslint-disable-next-line no-restricted-imports -- <reason>` for a legitimate realtime/read ref.",
};

/** The `no-restricted-imports` rule value carrying the Firestore restriction. */
export const firestoreImportRule = ["error", { paths: [firestoreImportRestriction] }];
