import { FirebaseError } from "firebase/app";
import {
  type Firestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { z } from "zod";
import { firestoreCollections, type Address, validateAddress } from "@luratha/schemas";
import { clientAddressConverter } from "@luratha/firestore/clientAddressConverter";

type AddressUpdateInput = Partial<Omit<Address, "id" | "createdAt">>;

type AddressRepositoryErrorCode = "validation" | "not_found" | "conflict" | "unknown";

export class AddressRepositoryError extends Error {
  readonly code: AddressRepositoryErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: AddressRepositoryErrorCode, cause?: unknown) {
    super(message);
    this.name = "AddressRepositoryError";
    this.code = code;
    this.cause = cause;
  }
}

export interface AddressesRepository {
  list(userId: string): Promise<Address[]>;
  getById(userId: string, addressId: string): Promise<Address | null>;
  create(userId: string, input: unknown): Promise<Address>;
  update(userId: string, addressId: string, patch: AddressUpdateInput): Promise<Address>;
  delete(userId: string, addressId: string): Promise<void>;
}

export function createAddressesRepository(dbInstance: Firestore): AddressesRepository {
  function addressesCollection(userId: string) {
    return collection(
      dbInstance,
      firestoreCollections.userProfiles,
      userId,
      firestoreCollections.addresses,
    ).withConverter(clientAddressConverter);
  }

  async function list(userId: string): Promise<Address[]> {
    try {
      const snapshot = await getDocs(addressesCollection(userId));
      return snapshot.docs.map((d) => d.data());
    } catch (error) {
      throw normalizeRepositoryError(error, `list addresses for user "${userId}"`);
    }
  }

  async function getById(userId: string, addressId: string): Promise<Address | null> {
    try {
      const ref = doc(addressesCollection(userId), addressId);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) return null;
      return snapshot.data();
    } catch (error) {
      throw normalizeRepositoryError(error, `read address "${addressId}" for user "${userId}"`);
    }
  }

  async function create(userId: string, input: unknown): Promise<Address> {
    try {
      const parsed = validateAddress(input);
      const ref = doc(addressesCollection(userId), parsed.id);

      const existing = await getDoc(ref);
      if (existing.exists()) {
        throw new AddressRepositoryError(
          `Address with id "${parsed.id}" already exists for user "${userId}"`,
          "conflict",
        );
      }

      // Se o novo endereço é default, desmarca os outros antes de salvar
      // para garantir um único default por usuário.
      if (parsed.isDefault) {
        await unsetOtherDefaults(userId);
      }

      await setDoc(ref, parsed);
      return parsed;
    } catch (error) {
      throw normalizeRepositoryError(error, `create address for user "${userId}"`);
    }
  }

  async function update(
    userId: string,
    addressId: string,
    patch: AddressUpdateInput,
  ): Promise<Address> {
    try {
      const ref = doc(addressesCollection(userId), addressId);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        throw new AddressRepositoryError(
          `Address "${addressId}" was not found for user "${userId}"`,
          "not_found",
        );
      }

      const current = snapshot.data();
      const merged = validateAddress({
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      });

      if (merged.isDefault && !current.isDefault) {
        await unsetOtherDefaults(userId, addressId);
      }

      await setDoc(ref, merged);
      return merged;
    } catch (error) {
      throw normalizeRepositoryError(
        error,
        `update address "${addressId}" for user "${userId}"`,
      );
    }
  }

  async function remove(userId: string, addressId: string): Promise<void> {
    try {
      const ref = doc(addressesCollection(userId), addressId);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        throw new AddressRepositoryError(
          `Address "${addressId}" was not found for user "${userId}"`,
          "not_found",
        );
      }
      await deleteDoc(ref);
    } catch (error) {
      throw normalizeRepositoryError(
        error,
        `delete address "${addressId}" for user "${userId}"`,
      );
    }
  }

  async function unsetOtherDefaults(userId: string, exceptId?: string): Promise<void> {
    const snapshot = await getDocs(
      query(addressesCollection(userId), where("isDefault", "==", true)),
    );
    if (snapshot.empty) return;

    const batch = writeBatch(dbInstance);
    for (const docSnap of snapshot.docs) {
      if (exceptId && docSnap.id === exceptId) continue;
      batch.set(docSnap.ref, { ...docSnap.data(), isDefault: false });
    }
    await batch.commit();
  }

  return {
    list,
    getById,
    create,
    update,
    delete: remove,
  };
}

function normalizeRepositoryError(error: unknown, action: string): AddressRepositoryError {
  if (error instanceof AddressRepositoryError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new AddressRepositoryError(
      `Validation failed while trying to ${action}`,
      "validation",
      error,
    );
  }

  if (error instanceof FirebaseError && error.code === "already-exists") {
    return new AddressRepositoryError(
      `Failed to ${action}: document already exists`,
      "conflict",
      error,
    );
  }

  if (error instanceof FirebaseError && error.code === "not-found") {
    return new AddressRepositoryError(
      `Failed to ${action}: document not found`,
      "not_found",
      error,
    );
  }

  if (error instanceof Error) {
    return new AddressRepositoryError(`Failed to ${action}: ${error.message}`, "unknown", error);
  }

  return new AddressRepositoryError(
    `Failed to ${action} due to an unknown error`,
    "unknown",
    error,
  );
}
