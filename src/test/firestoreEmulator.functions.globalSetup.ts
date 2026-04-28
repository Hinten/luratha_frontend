import { execSync } from "node:child_process";
import net from "node:net";
import { ensureFirestoreEmulator, stopFirestoreEmulator } from "@/src/test/firestoreEmulator";
import { DEFAULT_FIREBASE_FUNCTIONS_EMULATOR_HOST } from "@/src/lib/firestore/environment";

const FUNCTIONS_BUILD_TIMEOUT_MS = 120_000;

export default async function globalSetup(): Promise<() => Promise<void>> {
  // Step 1: Build the Firebase Functions TypeScript code so the Functions emulator
  // can load the compiled JS. If the build fails, skip all function tests gracefully.
  const buildSucceeded = await buildFunctions();
  if (!buildSucceeded) {
    process.env.FIRESTORE_EMULATOR_READY = "false";
    process.env.FUNCTIONS_EMULATOR_READY = "false";
    process.env.FUNCTIONS_EMULATOR_REASON = "Failed to build Firebase Functions (functions/src/index.ts)";
    console.warn(
      "[firestoreEmulator.functions.globalSetup] Functions build failed — all function tests will be skipped",
    );
    return async () => {};
  }

  // Step 2: Start emulators with Functions included (firestore, auth, storage, functions).
  const session = await ensureFirestoreEmulator({
    timeoutMs: 90_000,
    includeFunctions: true,
  });

  process.env.FIRESTORE_EMULATOR_READY = String(session.ready);

  if (!session.ready) {
    process.env.FUNCTIONS_EMULATOR_READY = "false";
    process.env.FUNCTIONS_EMULATOR_REASON =
      session.reason ?? "Firebase emulators (including Functions) could not start";
    console.warn(
      `[firestoreEmulator.functions.globalSetup] Emulators unavailable: ${process.env.FUNCTIONS_EMULATOR_REASON}`,
    );
    return async () => {};
  }

  // Step 3: Verify the Functions emulator port is actually open (it starts after Firestore).
  const { host, port } = parseFunctionsEmulatorAddress();
  const functionsReady = await isPortOpen(host, port, 2_000);

  process.env.FUNCTIONS_EMULATOR_READY = String(functionsReady);
  if (!functionsReady) {
    process.env.FUNCTIONS_EMULATOR_REASON = `Functions emulator port ${host}:${port} is not reachable`;
    console.warn(
      `[firestoreEmulator.functions.globalSetup] ${process.env.FUNCTIONS_EMULATOR_REASON}`,
    );
  }

  return async () => {
    await stopFirestoreEmulator(session);
  };
}

async function buildFunctions(): Promise<boolean> {
  try {
    console.log("[firestoreEmulator.functions.globalSetup] Installing functions dependencies…");
    execSync("npm install --prefer-offline", {
      cwd: "functions",
      stdio: "pipe",
      timeout: FUNCTIONS_BUILD_TIMEOUT_MS,
    });

    console.log("[firestoreEmulator.functions.globalSetup] Building Firebase Functions…");
    execSync("npm run build", {
      cwd: "functions",
      stdio: "pipe",
      timeout: FUNCTIONS_BUILD_TIMEOUT_MS,
    });

    console.log("[firestoreEmulator.functions.globalSetup] Functions build succeeded");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[firestoreEmulator.functions.globalSetup] Functions build failed:", message);
    return false;
  }
}

function parseFunctionsEmulatorAddress(): { host: string; port: number } {
  const raw =
    process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST ?? DEFAULT_FIREBASE_FUNCTIONS_EMULATOR_HOST;
  const [host, portStr] = raw.split(":");
  return { host: host ?? "127.0.0.1", port: Number(portStr ?? "5001") };
}

function isPortOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const onFailure = (): void => {
      socket.destroy();
      resolve(false);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("timeout", onFailure);
    socket.once("error", onFailure);
  });
}
