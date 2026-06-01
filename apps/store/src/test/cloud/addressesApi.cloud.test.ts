/**
 * Cloud integration tests for /api/users/[id]/addresses (e subrota /[addressId]).
 *
 * Roda contra o projeto Firebase real usando as credenciais de:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64
 *
 * Execute: npm run test:firestore
 */

import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
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

// Consulta de CEP mockada — a suíte cloud não deve depender do ViaCEP real.
const cep = vi.hoisted(() => ({ lookupCep: vi.fn() }));
vi.mock("@/src/lib/cep/viaCep", () => ({ lookupCep: cep.lookupCep }));

vi.mock("@luratha/auth/requireUser", () => {
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

import {
  GET as listAddresses,
  POST as createAddress,
} from "@/src/app/api/users/[id]/addresses/route";
import {
  GET as getAddress,
  PATCH as patchAddress,
  DELETE as deleteAddress,
} from "@/src/app/api/users/[id]/addresses/[addressId]/route";

type SeedDocument = { collection: string; id: string };

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

async function deleteAllAddresses(userId: string): Promise<void> {
  const snap = await adminDb
    .collection(firestoreCollections.userProfiles)
    .doc(userId)
    .collection(firestoreCollections.addresses)
    .get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

function buildAddressPayload(overrides: Record<string, unknown> = {}) {
  return {
    label: "Casa",
    recipientName: "João Silva",
    postalCode: "01310-100",
    line1: "Av. Paulista",
    number: "1578",
    complement: "Apto 42",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    country: "BR" as const,
    isDefault: false,
    ...overrides,
  };
}

describeCloud("/api/users/[id]/addresses (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const userId = `${prefix}-uid`;
  const seededDocs: SeedDocument[] = [
    { collection: firestoreCollections.userProfiles, id: userId },
  ];

  beforeAll(() => {
    mockAuthedUser({ uid: userId });
    cep.lookupCep.mockResolvedValue({
      status: "found",
      logradouro: "Av. Paulista",
      bairro: "Bela Vista",
      localidade: "São Paulo",
      uf: "SP",
      ibge: "3550308",
    });
  });

  afterAll(async () => {
    await deleteAllAddresses(userId);
    await cleanupDocuments(seededDocs);
    mockAuthedUser(null);
  });

  // ── POST ────────────────────────────────────────────────────────────────

  it("POST cria endereço com id/createdAt/updatedAt gerados pelo servidor", async () => {
    const response = await createAddress(
      new Request(`http://localhost/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAddressPayload()),
      }),
      { params: Promise.resolve({ id: userId }) },
    );

    expect(response.status).toBe(201);
    const created = (await response.json()) as {
      id: string;
      number: string;
      complement?: string;
      isDefault: boolean;
      ibgeCode?: string;
    };

    expect(created.id).toBeTruthy();
    expect(created.number).toBe("1578");
    expect(created.complement).toBe("Apto 42");
    expect(created.isDefault).toBe(false);
    // Enriquecido pelo lookup de CEP (mockado como found).
    expect(created.ibgeCode).toBe("3550308");
  });

  it("POST cria endereço mesmo quando o CEP não está no ViaCEP (aviso, não bloqueia)", async () => {
    cep.lookupCep.mockResolvedValueOnce({ status: "not_found" });

    const response = await createAddress(
      new Request(`http://localhost/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAddressPayload({ postalCode: "99999-999" })),
      }),
      { params: Promise.resolve({ id: userId }) },
    );

    expect(response.status).toBe(201);
    const created = (await response.json()) as { ibgeCode?: string };
    expect(created.ibgeCode).toBeUndefined();
  });

  it("POST retorna 400 quando number está ausente", async () => {
    const payload = buildAddressPayload();
    delete (payload as Record<string, unknown>).number;

    const response = await createAddress(
      new Request(`http://localhost/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ id: userId }) },
    );
    expect(response.status).toBe(400);
  });

  it("POST retorna 401 quando não autenticado", async () => {
    mockAuthedUser(null);
    const response = await createAddress(
      new Request(`http://localhost/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAddressPayload()),
      }),
      { params: Promise.resolve({ id: userId }) },
    );
    expect(response.status).toBe(401);
    mockAuthedUser({ uid: userId });
  });

  it("POST retorna 403 quando user tenta escrever no userId de outro", async () => {
    mockAuthedUser({ uid: "other-uid" });
    const response = await createAddress(
      new Request(`http://localhost/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAddressPayload()),
      }),
      { params: Promise.resolve({ id: userId }) },
    );
    expect(response.status).toBe(403);
    mockAuthedUser({ uid: userId });
  });

  // ── GET (list) ──────────────────────────────────────────────────────────

  it("GET lista todos os endereços do usuário", async () => {
    await createAddress(
      new Request(`http://localhost/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAddressPayload({ label: "Trabalho", number: "200" })),
      }),
      { params: Promise.resolve({ id: userId }) },
    );

    const response = await listAddresses(
      new Request(`http://localhost/api/users/${userId}/addresses`),
      { params: Promise.resolve({ id: userId }) },
    );

    expect(response.status).toBe(200);
    const addresses = (await response.json()) as Array<{ id: string }>;
    expect(addresses.length).toBeGreaterThanOrEqual(2);
  });

  it("GET admin lista endereços de qualquer user", async () => {
    mockAuthedUser({ uid: "admin-uid", isAdmin: true });
    const response = await listAddresses(
      new Request(`http://localhost/api/users/${userId}/addresses`),
      { params: Promise.resolve({ id: userId }) },
    );
    expect(response.status).toBe(200);
    mockAuthedUser({ uid: userId });
  });

  // ── GET /:addressId ────────────────────────────────────────────────────

  it("GET /:addressId retorna o endereço quando existe e 404 quando não", async () => {
    const create = await createAddress(
      new Request(`http://localhost/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAddressPayload()),
      }),
      { params: Promise.resolve({ id: userId }) },
    );
    const created = (await create.json()) as { id: string };

    const found = await getAddress(
      new Request(`http://localhost/api/users/${userId}/addresses/${created.id}`),
      { params: Promise.resolve({ id: userId, addressId: created.id }) },
    );
    expect(found.status).toBe(200);

    const missing = await getAddress(
      new Request(`http://localhost/api/users/${userId}/addresses/does-not-exist`),
      { params: Promise.resolve({ id: userId, addressId: "does-not-exist" }) },
    );
    expect(missing.status).toBe(404);
  });

  // ── PATCH preserva id/createdAt ────────────────────────────────────────

  it("PATCH atualiza um campo e preserva id/createdAt", async () => {
    const create = await createAddress(
      new Request(`http://localhost/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAddressPayload()),
      }),
      { params: Promise.resolve({ id: userId }) },
    );
    const created = (await create.json()) as { id: string; createdAt: string };

    const response = await patchAddress(
      new Request(`http://localhost/api/users/${userId}/addresses/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Casa atualizada", id: "trying-to-overwrite" }),
      }),
      { params: Promise.resolve({ id: userId, addressId: created.id }) },
    );

    expect(response.status).toBe(200);
    const updated = (await response.json()) as { id: string; label?: string; createdAt: string };
    expect(updated.id).toBe(created.id);
    expect(updated.label).toBe("Casa atualizada");
    expect(updated.createdAt).toBe(created.createdAt);
  });

  // ── PATCH default mutua-exclusivo ──────────────────────────────────────

  it("PATCH isDefault=true desmarca os outros defaults do mesmo usuário", async () => {
    await deleteAllAddresses(userId);

    const a = (await (
      await createAddress(
        new Request(`http://localhost/api/users/${userId}/addresses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildAddressPayload({ label: "A", isDefault: true })),
        }),
        { params: Promise.resolve({ id: userId }) },
      )
    ).json()) as { id: string };

    const b = (await (
      await createAddress(
        new Request(`http://localhost/api/users/${userId}/addresses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildAddressPayload({ label: "B", isDefault: false })),
        }),
        { params: Promise.resolve({ id: userId }) },
      )
    ).json()) as { id: string };

    const response = await patchAddress(
      new Request(`http://localhost/api/users/${userId}/addresses/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      }),
      { params: Promise.resolve({ id: userId, addressId: b.id }) },
    );
    expect(response.status).toBe(200);

    const list = (await (
      await listAddresses(new Request(`http://localhost/api/users/${userId}/addresses`), {
        params: Promise.resolve({ id: userId }),
      })
    ).json()) as Array<{ id: string; isDefault: boolean }>;

    const aFromList = list.find((x) => x.id === a.id);
    const bFromList = list.find((x) => x.id === b.id);
    expect(aFromList?.isDefault).toBe(false);
    expect(bFromList?.isDefault).toBe(true);
  });

  // ── DELETE ──────────────────────────────────────────────────────────────

  it("DELETE retorna 204 e remove o endereço", async () => {
    const create = await createAddress(
      new Request(`http://localhost/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAddressPayload()),
      }),
      { params: Promise.resolve({ id: userId }) },
    );
    const created = (await create.json()) as { id: string };

    const response = await deleteAddress(
      new Request(`http://localhost/api/users/${userId}/addresses/${created.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: userId, addressId: created.id }) },
    );
    expect(response.status).toBe(204);

    const after = await getAddress(
      new Request(`http://localhost/api/users/${userId}/addresses/${created.id}`),
      { params: Promise.resolve({ id: userId, addressId: created.id }) },
    );
    expect(after.status).toBe(404);
  });

  it("DELETE retorna 403 quando user tenta deletar do userId de outro", async () => {
    const create = await createAddress(
      new Request(`http://localhost/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAddressPayload()),
      }),
      { params: Promise.resolve({ id: userId }) },
    );
    const created = (await create.json()) as { id: string };

    mockAuthedUser({ uid: "other-uid" });
    const response = await deleteAddress(
      new Request(`http://localhost/api/users/${userId}/addresses/${created.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: userId, addressId: created.id }) },
    );
    expect(response.status).toBe(403);
    mockAuthedUser({ uid: userId });
  });
});
