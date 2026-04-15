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

  const emulatorProcess = spawnFirebaseEmulatorProcess(projectId);

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
    { projectId: process.env.FIREBASE_PROJECT_ID ?? "luratha-96386" },
    FIREBASE_APP_NAME,
  );
}

async function isFirestoreEmulatorReady(
  host: string,
  port: number,
  _projectId: string,
  timeoutMs: number,
): Promise<boolean> {
  return isPortOpen(host, port, timeoutMs);
}

async function terminateProcessTree(processRef: ChildProcess): Promise<void> {
  if (!processRef.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(processRef.pid), "/T"], { stdio: "ignore" });
    await sleep(250);
    if (processRef.exitCode === null) {
      spawnSync("taskkill", ["/PID", String(processRef.pid), "/T", "/F"], { stdio: "ignore" });
    }
    return;
  }

  processRef.kill("SIGTERM");
}

function spawnFirebaseEmulatorProcess(projectId: string): ChildProcess {
  const firebaseArgs = [
    "firebase",
    "emulators:start",
    "--only",
    "firestore",
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
