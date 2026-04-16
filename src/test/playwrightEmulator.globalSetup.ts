import net from "node:net";
import { getFirestoreForEmulator } from "@/src/test/firestoreEmulator";
import { seedE2eFirestore } from "@/src/test/seedE2eFirestore";

/**
 * Global setup for Playwright E2E tests with Firebase Emulator.
 * Starts the Firestore emulator and seeds test data before tests run.
 */
export default async function globalSetup() {
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "luratha-96386";
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

  const [host, portString] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
  const port = Number(portString);
  const ready = await waitForPort(host, port, 25_000);
  if (!ready) {
    throw new Error(
      `[Playwright globalSetup] Firestore emulator not reachable at ${host}:${port}`,
    );
  }

  console.log("[Playwright globalSetup] Firestore emulator reachable. Seeding E2E data...");
  
  try {
    const db = getFirestoreForEmulator();
    await seedE2eFirestore(db);
    console.log("[Playwright globalSetup] E2E data seeded successfully.");
  } catch (error) {
    console.error("[Playwright globalSetup] Failed to seed E2E data:", error);
    throw error;
  }

  return async () => {
    // Emulator lifecycle is managed by firebase emulators:exec.
  };
}

async function waitForPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await isPortOpen(host, port, 500);
    if (ok) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function isPortOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const fail = () => {
      socket.destroy();
      resolve(false);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("timeout", fail);
    socket.once("error", fail);
  });
}
