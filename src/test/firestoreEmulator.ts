import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { initializeApp, getApp, getApps } from "firebase/app";
import { type Firestore, connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import {
  DEFAULT_FIREBASE_PROJECT_ID,
  FIREBASE_EMULATOR_ENV,
  applyEmulatorEnvironmentDefaults,
  getFirestoreEmulatorHost,
  parseHostAndPort,
} from "@/src/lib/firestore/environment";

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

export type AdminFirestoreAuthSession = {
  db: Firestore;
  cleanup: () => Promise<void>;
};

const FIREBASE_APP_NAME = "firestore-emulator-tests";
let firestoreConnected = false;

export async function ensureFirestoreEmulator(
  options: EnsureFirestoreEmulatorOptions = {},
): Promise<FirestoreEmulatorSession> {
  const projectId = options.projectId ?? process.env.FIREBASE_PROJECT_ID ?? DEFAULT_FIREBASE_PROJECT_ID;
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8080;
  const timeoutMs = options.timeoutMs ?? 25_000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;

  process.env.USE_EMULATOR = process.env.USE_EMULATOR ?? FIREBASE_EMULATOR_ENV.USE_EMULATOR;
  applyEmulatorEnvironmentDefaults();

  process.env.GCLOUD_PROJECT = projectId;
  process.env.FIREBASE_PROJECT_ID = projectId;
  process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST ?? FIREBASE_EMULATOR_ENV.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? FIREBASE_EMULATOR_ENV.FIREBASE_STORAGE_EMULATOR_HOST;
  process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST =
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? process.env.FIRESTORE_EMULATOR_HOST;
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? process.env.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  process.env.FIREBASE_CLI_DISABLE_UPDATE_CHECK =
    process.env.FIREBASE_CLI_DISABLE_UPDATE_CHECK ?? "1";
  process.env.FIREBASE_CLI_EXPERIMENTS = process.env.FIREBASE_CLI_EXPERIMENTS ?? "";
  process.env.NO_GCE_CHECK = process.env.NO_GCE_CHECK ?? "true";
  process.env.GOOGLE_CLOUD_DISABLE_METADATA = process.env.GOOGLE_CLOUD_DISABLE_METADATA ?? "true";
  process.env.CLOUDSDK_CORE_DISABLE_PROMPTS =
    process.env.CLOUDSDK_CORE_DISABLE_PROMPTS ?? "1";

  if (await areFirebaseEmulatorsReady(host, port, Math.min(700, pollIntervalMs))) {
    return { ready: true, startedByTest: false };
  }

  const emulatorProcess = spawnFirebaseEmulatorProcess(projectId);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await areFirebaseEmulatorsReady(host, port, Math.min(700, pollIntervalMs))) {
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
    reason: `Firebase emulators (firestore/auth/storage) did not become available within ${timeoutMs}ms`,
  };
}

export async function authenticateAdminForEmulator(
  projectId = process.env.FIREBASE_PROJECT_ID ?? DEFAULT_FIREBASE_PROJECT_ID,
  uid = "emulator-admin-user",
): Promise<AdminFirestoreAuthSession> {
  const firestoreHost = getFirestoreEmulatorHost();
  const { host, port } = parseHostAndPort(firestoreHost, "FIRESTORE_EMULATOR_HOST");

  const rules = await readFile(path.join(process.cwd(), "firestore.rules"), "utf8");
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port,
      rules,
    },
  });

  const db = testEnv.authenticatedContext(uid, { admin: true }).firestore() as unknown as Firestore;

  return {
    db,
    cleanup: async () => {
      await cleanupRulesTestEnvironment(testEnv);
    },
  };
}

export function getFirestoreForEmulator(
  projectId = process.env.FIREBASE_PROJECT_ID ?? DEFAULT_FIREBASE_PROJECT_ID,
): Firestore {
  const app =
    getApps().find((candidate) => candidate.name === FIREBASE_APP_NAME) ??
    initializeApp({ projectId }, FIREBASE_APP_NAME);

  const db = getFirestore(app);
  if (!firestoreConnected) {
    const { host, port } = parseHostAndPort(getFirestoreEmulatorHost(), "FIRESTORE_EMULATOR_HOST");
    connectFirestoreEmulator(db, host, port);
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

    await Promise.all(snapshot.map((ref) => ref()));
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

  await terminateProcessTree(session.process);
  await sleep(500);
}

export async function stopFirestoreEmulatorByPid(pid: number): Promise<void> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }

  await terminateProcessTreeByPid(pid);
  await sleep(500);
}

type DeleteDocumentOperation = () => Promise<void>;

async function getDocsInBatches(
  db: Firestore,
  collectionName: string,
  batchSize: number,
): Promise<DeleteDocumentOperation[]> {
  const { collection, deleteDoc, getDocs, limit, query } = await import("firebase/firestore");
  const snapshot = await getDocs(query(collection(db, collectionName), limit(batchSize)));
  return snapshot.docs.map((entry) => () => deleteDoc(entry.ref));
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
    { projectId: process.env.FIREBASE_PROJECT_ID ?? DEFAULT_FIREBASE_PROJECT_ID },
    FIREBASE_APP_NAME,
  );
}

async function areFirebaseEmulatorsReady(
  firestoreHost: string,
  firestorePort: number,
  timeoutMs: number,
): Promise<boolean> {
  const authAddress = parseHostAndPort(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ?? FIREBASE_EMULATOR_ENV.FIREBASE_AUTH_EMULATOR_HOST,
    "FIREBASE_AUTH_EMULATOR_HOST",
  );
  const storageAddress = parseHostAndPort(
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? FIREBASE_EMULATOR_ENV.FIREBASE_STORAGE_EMULATOR_HOST,
    "FIREBASE_STORAGE_EMULATOR_HOST",
  );

  const statuses = await Promise.all([
    isPortOpen(firestoreHost, firestorePort, timeoutMs),
    isPortOpen(authAddress.host, authAddress.port, timeoutMs),
    isPortOpen(storageAddress.host, storageAddress.port, timeoutMs),
  ]);

  return statuses.every(Boolean);
}

async function terminateProcessTree(processRef: ChildProcess): Promise<void> {
  if (!processRef.pid) {
    return;
  }

  await terminateProcessTreeByPid(processRef.pid);
}

async function terminateProcessTreeByPid(pid: number): Promise<void> {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T"], { stdio: "ignore" });
    await sleep(250);
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  process.kill(pid, "SIGTERM");
}

function spawnFirebaseEmulatorProcess(projectId: string): ChildProcess {
  const firebaseArgs = [
    "firebase",
    "emulators:start",
    "--only",
    "firestore,auth,storage",
    "--project",
    projectId,
    "--config",
    "firebase.json",
    "--non-interactive",
  ];

  if (process.platform === "win32") {
    const command = quoteForWindowsShell(["npx", ...firebaseArgs]);
    return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
      },
    });
  }

  return spawn("npx", firebaseArgs, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
    },
  });
}

function quoteForWindowsShell(args: string[]): string {
  return args
    .map((arg) => {
      if (!/[\s"]/u.test(arg)) {
        return arg;
      }

      return `"${arg.replace(/"/gu, '""')}"`;
    })
    .join(" ");
}

async function cleanupRulesTestEnvironment(testEnv: RulesTestEnvironment): Promise<void> {
  await testEnv.cleanup();
}
