import { adminApp } from "@luratha/firestore/firebaseAdmin";
import { DATABASE_NAME, getFirebaseProjectId } from "@luratha/firestore/environment";

/**
 * Ensures the composite index the feed pipeline depends on exists (and is READY)
 * in the cloud test project before the suite runs.
 *
 * `fetchFeedProducts` executes with `indexMode: "recommended"`, which forces
 * Firestore to use the (status, isPurchasable) composite index and throws
 * FAILED_PRECONDITION when it is missing. Rather than relying on an out-of-band
 * `firebase deploy --only firestore:indexes`, the cloud suite provisions the
 * index itself through the Firestore Admin REST API, authenticating with the
 * same service-account credential the Admin SDK already loaded. The operation is
 * idempotent: once the index is READY this is a single cheap LIST call.
 *
 * Mirrors the entry in `firestore.indexes.json` — keep both in sync.
 */

const FIRESTORE_ADMIN_BASE = "https://firestore.googleapis.com/v1";

interface IndexField {
  fieldPath: string;
  order?: string;
}

/** The feed query's index, excluding the implicit `__name__` field. */
const FEED_INDEX_FIELDS: IndexField[] = [
  { fieldPath: "status", order: "ASCENDING" },
  { fieldPath: "isPurchasable", order: "ASCENDING" },
];

interface ListIndexesResponse {
  indexes?: { fields?: IndexField[]; state?: string }[];
}

function matchesFeedIndex(fields: IndexField[]): boolean {
  // The Admin API appends the implicit `__name__` field — ignore it when matching.
  const explicit = fields.filter((f) => f.fieldPath !== "__name__");
  if (explicit.length !== FEED_INDEX_FIELDS.length) return false;
  return FEED_INDEX_FIELDS.every(
    (want, i) =>
      explicit[i]?.fieldPath === want.fieldPath &&
      (explicit[i]?.order ?? "ASCENDING") === want.order,
  );
}

async function getAccessToken(): Promise<string> {
  const credential = adminApp.options.credential;
  if (!credential) throw new Error("ensureFeedIndex: admin app has no credential");
  const token = await credential.getAccessToken();
  return token.access_token;
}

async function readyIndexExists(indexesUrl: string, accessToken: string): Promise<boolean> {
  const res = await fetch(indexesUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`ensureFeedIndex: list indexes failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as ListIndexesResponse;
  return (body.indexes ?? []).some(
    (idx) => idx.state === "READY" && matchesFeedIndex(idx.fields ?? []),
  );
}

export async function ensureFeedIndex(): Promise<void> {
  const projectId = adminApp.options.projectId ?? getFirebaseProjectId();
  const accessToken = await getAccessToken();
  const indexesUrl =
    `${FIRESTORE_ADMIN_BASE}/projects/${projectId}/databases/${DATABASE_NAME}` +
    `/collectionGroups/products/indexes`;

  if (await readyIndexExists(indexesUrl, accessToken)) return;

  // Create the index. A concurrent run may have created it first — treat the
  // resulting 409 ALREADY_EXISTS as success and fall through to polling.
  const createRes = await fetch(indexesUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ queryScope: "COLLECTION", fields: FEED_INDEX_FIELDS }),
  });
  if (!createRes.ok && createRes.status !== 409) {
    throw new Error(
      `ensureFeedIndex: create index failed (${createRes.status}): ${await createRes.text()}`,
    );
  }

  // Index builds are asynchronous — poll until it reports READY.
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (await readyIndexExists(indexesUrl, accessToken)) return;
  }
  throw new Error("ensureFeedIndex: composite index did not reach READY within 120s");
}
