/**
 * Cloud integration tests for the /api/users/[id] endpoints.
 *
 * Runs against a real Firebase project using credentials provided via:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 – service account for admin-level seeding/cleanup
 *
 * Execute: npm run test:firestore
 *
 * The suite is automatically skipped when credentials are not available.
 */

import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminUserProfileConverter } from "@/src/lib/firestore/adminUserProfileConverter";
import { firestoreCollections } from "@luratha/schemas";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

const auth = vi.hoisted(() => ({
  state: { current: null as { uid: string; email: string | null; isAdmin: boolean } | null },
}));
function mockAuthedUser(opts: { uid: string; isAdmin?: boolean; email?: string | null } | null) {
  auth.state.current = opts
    ? {
        uid: opts.uid,
        email: opts.email ?? `${opts.uid}@test.luratha`,
        isAdmin: opts.isAdmin ?? false,
      }
    : null;
}

vi.mock("@/src/lib/auth/requireUser", () => {
  class AuthError extends Error {
    constructor(public readonly status: 401 | 403, message: string) {
      super(message);
      this.name = "AuthError";
    }
  }
  return {
    SESSION_COOKIE_NAME: "__session",
    AuthError,
    requireUser: async () => {
      if (!auth.state.current) throw new AuthError(401, "Não autenticado.");
      return auth.state.current;
    },
    requireOwnerOrAdmin: async (target: string) => {
      if (!auth.state.current) throw new AuthError(401, "Não autenticado.");
      const u = auth.state.current;
      if (u.isAdmin || u.uid === target) return u;
      throw new AuthError(403, "Acesso negado.");
    },
    authErrorResponse: (err: unknown) => {
      if (err instanceof AuthError) {
        return NextResponse.json({ message: err.message }, { status: err.status });
      }
      return null;
    },
  };
});

import { GET as userGET, PATCH as userPATCH } from "@/src/app/api/users/[id]/route";

type SeedDocument = { collection: string; id: string };

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

describeCloud("/api/users/[id] (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const seededDocs: SeedDocument[] = [];
  let userId: string;

  beforeAll(async () => {
    userId = `${prefix}-uid`;
    mockAuthedUser({ uid: userId });
    const now = new Date().toISOString();

    const profileRef = adminDb
      .collection(firestoreCollections.userProfiles)
      .doc(userId)
      .withConverter(adminUserProfileConverter);

    await profileRef.set({
      id: userId,
      email: `cloud-test-${prefix}@example.com`,
      firstName: "Cloud",
      lastName: "Tester",
      role: "customer",
      createdAt: now,
      updatedAt: now,
    });

    seededDocs.push({ collection: firestoreCollections.userProfiles, id: userId });
  });

  afterAll(async () => {
    await cleanupDocuments(seededDocs);
    mockAuthedUser(null);
  });

  // ── GET ─────────────────────────────────────────────────────────────────

  it("GET /api/users/:id returns the profile", async () => {
    const response = await userGET(new Request(`http://localhost/api/users/${userId}`), {
      params: Promise.resolve({ id: userId }),
    });

    expect(response.status).toBe(200);
    const profile = (await response.json()) as {
      id: string;
      email: string;
      firstName: string;
      role: string;
    };
    expect(profile.id).toBe(userId);
    expect(profile.firstName).toBe("Cloud");
    expect(profile.role).toBe("customer");
  });

  it("GET /api/users/:id returns 401 when no session", async () => {
    mockAuthedUser(null);
    const response = await userGET(new Request(`http://localhost/api/users/${userId}`), {
      params: Promise.resolve({ id: userId }),
    });
    expect(response.status).toBe(401);
    mockAuthedUser({ uid: userId });
  });

  it("GET /api/users/:id returns 403 when accessing other user's profile", async () => {
    mockAuthedUser({ uid: "other-uid" });
    const response = await userGET(new Request(`http://localhost/api/users/${userId}`), {
      params: Promise.resolve({ id: userId }),
    });
    expect(response.status).toBe(403);
    mockAuthedUser({ uid: userId });
  });

  it("GET /api/users/:id allows admin to access another user's profile", async () => {
    mockAuthedUser({ uid: "admin-uid", isAdmin: true });
    const response = await userGET(new Request(`http://localhost/api/users/${userId}`), {
      params: Promise.resolve({ id: userId }),
    });
    expect(response.status).toBe(200);
    mockAuthedUser({ uid: userId });
  });

  it("GET /api/users/:id returns 404 when profile does not exist", async () => {
    mockAuthedUser({ uid: "never-seeded-uid" });
    const response = await userGET(new Request("http://localhost/api/users/never-seeded-uid"), {
      params: Promise.resolve({ id: "never-seeded-uid" }),
    });
    expect(response.status).toBe(404);
    mockAuthedUser({ uid: userId });
  });

  // ── PATCH ───────────────────────────────────────────────────────────────

  it("PATCH /api/users/:id updates firstName and preserves id/createdAt", async () => {
    const beforeSnap = await adminDb
      .collection(firestoreCollections.userProfiles)
      .doc(userId)
      .get();
    const storedCreatedAt = (beforeSnap.data()?.createdAt as Timestamp).toDate().toISOString();

    const response = await userPATCH(
      new Request(`http://localhost/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Atualizado", id: "trying-to-overwrite" }),
      }),
      { params: Promise.resolve({ id: userId }) },
    );

    expect(response.status).toBe(200);
    const updated = (await response.json()) as {
      id: string;
      firstName: string;
      createdAt: string;
      updatedAt: string;
    };

    expect(updated.id).toBe(userId);
    expect(updated.firstName).toBe("Atualizado");
    expect(updated.createdAt).toBe(storedCreatedAt);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(storedCreatedAt).getTime() - 1,
    );
  });

  it("PATCH /api/users/:id returns 404 when profile does not exist", async () => {
    mockAuthedUser({ uid: "missing-uid" });
    const response = await userPATCH(
      new Request("http://localhost/api/users/missing-uid", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Foo" }),
      }),
      { params: Promise.resolve({ id: "missing-uid" }) },
    );
    expect(response.status).toBe(404);
    mockAuthedUser({ uid: userId });
  });

  it("PATCH /api/users/:id returns 400 when email is invalid", async () => {
    const response = await userPATCH(
      new Request(`http://localhost/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
      { params: Promise.resolve({ id: userId }) },
    );
    expect(response.status).toBe(400);
  });
});
