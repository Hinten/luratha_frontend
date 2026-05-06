/**
 * Cloud integration tests for /api/users/[id]/addresses (e subrota /[addressId]).
 *
 * Roda contra o projeto Firebase real usando as credenciais de:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64
 *
 * Execute: npm run test:firestore
 *
 * Cobre:
 *   1. POST  cria endereço; servidor gera id/createdAt/updatedAt
 *   2. GET   lista todos os endereços do usuário
 *   3. GET   /:addressId retorna o endereço
 *   4. PATCH atualiza um campo, preserva id/createdAt
 *   5. PATCH promovendo a default desmarca o anterior (invariante "1 default")
 *   6. DELETE remove e responde 204
 *   7. 400 quando o endereço é inválido (falta `number`)
 */

import { afterAll, expect, it } from "vitest";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { firestoreCollections } from "@/src/schemas/firestore";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";
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

  afterAll(async () => {
    await deleteAllAddresses(userId);
    await cleanupDocuments(seededDocs);
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
    };

    expect(created.id).toBeTruthy();
    expect(created.number).toBe("1578");
    expect(created.complement).toBe("Apto 42");
    expect(created.isDefault).toBe(false);
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

  // ── GET (list) ──────────────────────────────────────────────────────────

  it("GET lista todos os endereços do usuário", async () => {
    // garante ao menos 2 endereços
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
    // Limpa tudo antes para deixar o estado controlado
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

    // Promove B a default
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
});
