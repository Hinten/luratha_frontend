import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { initializeApp, getApp, getApps } from "firebase/app";
import { type Firestore, connectFirestoreEmulator, getFirestore } from "firebase/firestore";

type EnsureFirestoreEmulatorOptions = {
  projectId?: string;
  host?: string;
  port?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
};

export type FirestoreEmulatorSession = {
  ready: boolean;
  startedByTest: boolean;
  process?: ChildProcess;
  reason?: string;
};

const FIREBASE_APP_NAME = "firestore-emulator-tests";
const NPX_COMMAND = process.platform === "win32" ? "npx.cmd" : "npx";
let firestoreConnected = false;

export async function ensureFirestoreEmulator(
  options: EnsureFirestoreEmulatorOptions = {},
): Promise<FirestoreEmulatorSession> {
  const projectId = options.projectId ?? process.env.FIREBASE_PROJECT_ID ?? "luratha-96386";
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8080;
  const timeoutMs = options.timeoutMs ?? 25_000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;

  process.env.GCLOUD_PROJECT = projectId;
  process.env.FIREBASE_PROJECT_ID = projectId;
  process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
  process.env.FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
  process.env.FIREBASE_CLI_DISABLE_UPDATE_CHECK =
    process.env.FIREBASE_CLI_DISABLE_UPDATE_CHECK ?? "1";
  process.env.FIREBASE_CLI_EXPERIMENTS = process.env.FIREBASE_CLI_EXPERIMENTS ?? "";
  process.env.NO_GCE_CHECK = process.env.NO_GCE_CHECK ?? "true";
  process.env.GOOGLE_CLOUD_DISABLE_METADATA = process.env.GOOGLE_CLOUD_DISABLE_METADATA ?? "true";
  process.env.CLOUDSDK_CORE_DISABLE_PROMPTS =
    process.env.CLOUDSDK_CORE_DISABLE_PROMPTS ?? "1";

  if (await isFirestoreEmulatorReady(host, port, projectId, Math.min(700, pollIntervalMs))) {
    return { ready: true, startedByTest: false };
  }

  const emulatorProcess = spawn(
    NPX_COMMAND,
    [
      "firebase",
      "emulators:start",
      "--only",
      "firestore",
      "--project",
      projectId,
      "--config",
      "firebase.json",
      "--non-interactive",
      "--quiet",
    ],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
      },
    },
  );

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isFirestoreEmulatorReady(host, port, projectId, Math.min(700, pollIntervalMs))) {
      return {
        ready: true,
        startedByTest: true,
        process: emulatorProcess,
      };
    }

    if (emulatorProcess.exitCode !== null) {
      return {
        ready: false,
        startedByTest: true,
        reason: `firebase emulators:start exited with code ${emulatorProcess.exitCode}`,
      };
    }

    await sleep(100);
  }

  if (emulatorProcess.exitCode === null) {
    emulatorProcess.kill("SIGTERM");
  }

  return {
    ready: false,
    startedByTest: true,
    reason: `Firestore emulator did not become available within ${timeoutMs}ms`,
  };
}

export function getFirestoreForEmulator(
  projectId = process.env.FIREBASE_PROJECT_ID ?? "luratha-96386",
): Firestore {
  const app =
    getApps().find((candidate) => candidate.name === FIREBASE_APP_NAME) ??
    initializeApp({ projectId }, FIREBASE_APP_NAME);

  const db = getFirestore(app);
  if (!firestoreConnected) {
    const [host, portString] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
    connectFirestoreEmulator(db, host, Number(portString));
    firestoreConnected = true;
  }

  return db;
}

export async function clearFirestoreCollection(db: Firestore, collectionName: string): Promise<void> {
  const MAX_ITERATIONS = 100;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    const snapshot = await getDocsInBatches(db, collectionName, 50);
    if (snapshot.length === 0) {
      return;
    }

    await Promise.all(snapshot.map((ref) => ref.delete()));
    iterations += 1;
  }

  throw new Error(
    `Exceeded cleanup iteration limit (${MAX_ITERATIONS}) while clearing collection "${collectionName}"`,
  );
}

export async function stopFirestoreEmulator(session: FirestoreEmulatorSession): Promise<void> {
  if (!session.startedByTest || !session.process || session.process.exitCode !== null) {
    return;
  }

  terminateProcessTree(session.process);
  await sleep(500);
}

type MinimalDocumentRef = { delete: () => Promise<void> };

async function getDocsInBatches(
  db: Firestore,
  collectionName: string,
  batchSize: number,
): Promise<MinimalDocumentRef[]> {
  const { collection, getDocs, limit, query } = await import("firebase/firestore");
  const snapshot = await getDocs(query(collection(db, collectionName), limit(batchSize)));
  return snapshot.docs.map((entry) => entry.ref);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getFirebaseTestApp() {
  if (getApps().find((candidate) => candidate.name === FIREBASE_APP_NAME)) {
    return getApp(FIREBASE_APP_NAME);
  }
  return initializeApp(
    { projectId: process.env.FIREBASE_PROJECT_ID ?? "luratha-96386" },
    FIREBASE_APP_NAME,
  );
}

async function isFirestoreEmulatorReady(
  host: string,
  port: number,
  projectId: string,
  timeoutMs: number,
): Promise<boolean> {
  if (!(await isPortOpen(host, port, timeoutMs))) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `http://${host}:${port}/emulator/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`,
      {
        method: "GET",
        signal: controller.signal,
      },
    );
    return response.ok;
  } catch {
    if (process.env.FIREBASE_EMULATOR_DEBUG === "true") {
      console.warn("[firestoreEmulator] readiness probe failed");
    }
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function terminateProcessTree(processRef: ChildProcess): void {
  if (!processRef.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(processRef.pid), "/T"], { stdio: "ignore" });
    if (processRef.exitCode === null) {
      spawnSync("taskkill", ["/PID", String(processRef.pid), "/T", "/F"], { stdio: "ignore" });
    }
    return;
  }

  processRef.kill("SIGTERM");
}
