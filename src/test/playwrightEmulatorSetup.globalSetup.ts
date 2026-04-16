import { authenticateAdminForEmulator, ensureFirestoreEmulator } from "@/src/test/firestoreEmulator";
import { seedE2eFirestore } from "./seedE2eFirestore";

export default async function globalSetup(): Promise<void> {
  const session = await ensureFirestoreEmulator({ timeoutMs: 25_000 });

  process.env.FIRESTORE_EMULATOR_READY = String(session.ready);
  process.env.FIRESTORE_EMULATOR_REASON = session.reason ?? "";
  process.env.FIRESTORE_EMULATOR_STARTED_BY_TEST = String(session.startedByTest);
  process.env.FIRESTORE_EMULATOR_PID = session.process?.pid ? String(session.process.pid) : "";

  if (!session.ready) {
    throw new Error(
      `[playwrightEmulatorSetup.globalSetup] emulator unavailable: ${session.reason ?? "unknown startup error"}`,
    );
  }

  const adminSession = await authenticateAdminForEmulator();
  try {
    await seedE2eFirestore(adminSession.db);
  } finally {
    await adminSession.cleanup();
  }
}
