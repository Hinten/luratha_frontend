import { ensureFirestoreEmulator, stopFirestoreEmulator } from "@/src/test/firestoreEmulator";

export default async function globalSetup(): Promise<() => Promise<void>> {
  const session = await ensureFirestoreEmulator({ timeoutMs: 25_000 });

  process.env.FIRESTORE_EMULATOR_READY = String(session.ready);
  process.env.FIRESTORE_EMULATOR_REASON = session.reason ?? "";

  if (!session.ready) {
    console.warn(
      `[firestoreEmulator.globalSetup] emulator unavailable: ${session.reason ?? "unknown startup error"}`,
    );
  }

  return async () => {
    await stopFirestoreEmulator(session);
  };
}
