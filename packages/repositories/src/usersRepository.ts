import { FirebaseError } from "firebase/app";
import {
  type Firestore,
  collection,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { z } from "zod";
import { firestoreCollections, type UserProfile, validateUserProfile } from "@luratha/schemas";
import { clientUserProfileConverter } from "@luratha/firestore/clientUserProfileConverter";

type UserProfileUpdateInput = Partial<Omit<UserProfile, "id" | "createdAt">>;

type UserRepositoryErrorCode = "validation" | "not_found" | "conflict" | "unknown";

export class UserRepositoryError extends Error {
  readonly code: UserRepositoryErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: UserRepositoryErrorCode, cause?: unknown) {
    super(message);
    this.name = "UserRepositoryError";
    this.code = code;
    this.cause = cause;
  }
}

export interface UsersRepository {
  create(input: unknown): Promise<UserProfile>;
  getById(id: string): Promise<UserProfile | null>;
  update(id: string, patch: UserProfileUpdateInput): Promise<UserProfile>;
  upsert(input: unknown): Promise<UserProfile>;
}

export function createUsersRepository(dbInstance: Firestore): UsersRepository {
  const usersCollectionRef = collection(dbInstance, firestoreCollections.userProfiles).withConverter(
    clientUserProfileConverter,
  );

  async function create(input: unknown): Promise<UserProfile> {
    try {
      const parsed = validateUserProfile(input);
      const profileRef = doc(usersCollectionRef, parsed.id);

      const existing = await getDoc(profileRef);
      if (existing.exists()) {
        throw new UserRepositoryError(
          `User profile with id "${parsed.id}" already exists`,
          "conflict",
        );
      }

      await setDoc(profileRef, parsed);
      return parsed;
    } catch (error) {
      throw normalizeRepositoryError(error, "create user profile");
    }
  }

  async function getById(id: string): Promise<UserProfile | null> {
    try {
      const profileRef = doc(usersCollectionRef, id);
      const snapshot = await getDoc(profileRef);

      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.data();
    } catch (error) {
      throw normalizeRepositoryError(error, `read user profile "${id}"`);
    }
  }

  async function update(id: string, patch: UserProfileUpdateInput): Promise<UserProfile> {
    try {
      const profileRef = doc(usersCollectionRef, id);
      const snapshot = await getDoc(profileRef);

      if (!snapshot.exists()) {
        throw new UserRepositoryError(`User profile "${id}" was not found`, "not_found");
      }

      const current = snapshot.data();
      const merged = validateUserProfile({
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      });

      await setDoc(profileRef, merged);
      return merged;
    } catch (error) {
      throw normalizeRepositoryError(error, `update user profile "${id}"`);
    }
  }

  // Idempotent create-or-update — useful right after Firebase Auth sign-up
  // when we don't know whether a profile doc already exists.
  async function upsert(input: unknown): Promise<UserProfile> {
    try {
      const parsed = validateUserProfile(input);
      const profileRef = doc(usersCollectionRef, parsed.id);
      await setDoc(profileRef, parsed, { merge: false });
      return parsed;
    } catch (error) {
      throw normalizeRepositoryError(error, "upsert user profile");
    }
  }

  return {
    create,
    getById,
    update,
    upsert,
  };
}

function normalizeRepositoryError(error: unknown, action: string): UserRepositoryError {
  if (error instanceof UserRepositoryError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new UserRepositoryError(
      `Validation failed while trying to ${action}`,
      "validation",
      error,
    );
  }

  if (error instanceof FirebaseError && error.code === "already-exists") {
    return new UserRepositoryError(
      `Failed to ${action}: document already exists`,
      "conflict",
      error,
    );
  }

  if (error instanceof FirebaseError && error.code === "not-found") {
    return new UserRepositoryError(
      `Failed to ${action}: document not found`,
      "not_found",
      error,
    );
  }

  if (error instanceof Error) {
    return new UserRepositoryError(`Failed to ${action}: ${error.message}`, "unknown", error);
  }

  return new UserRepositoryError(`Failed to ${action} due to an unknown error`, "unknown", error);
}
