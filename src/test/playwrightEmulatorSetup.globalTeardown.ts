import {
  ensureFirestoreEmulator,
  stopFirestoreEmulator,
  stopFirestoreEmulatorByPid,
} from "@/src/test/firestoreEmulator";

export default async function globalTeardown(): Promise<void> {
  const startedByTest = process.env.FIRESTORE_EMULATOR_STARTED_BY_TEST === "true";
  const emulatorPid = Number(process.env.FIRESTORE_EMULATOR_PID);

  if (startedByTest && Number.isInteger(emulatorPid) && emulatorPid > 0) {
    await stopFirestoreEmulatorByPid(emulatorPid);
    return;
  }

  const session = await ensureFirestoreEmulator({ timeoutMs: 25_000 });
  await stopFirestoreEmulator(session);
}
