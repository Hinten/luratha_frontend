import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Walks up from `process.cwd()` looking for the monorepo root, identified by
 * `pnpm-workspace.yaml`. Returns `null` when no marker is found (e.g. a
 * standalone production build) — callers treat that as "no local `.env`".
 *
 * Deliberately avoids `import.meta`/`__dirname` so the loader behaves the same
 * whether a config imports it as ESM (Next.js, Vitest) or CJS (Playwright).
 */
function findRepoRoot(): string | null {
  let dir = process.cwd();
  while (true) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Loads the single repo-root `.env` into `process.env`.
 *
 * Each app lives in `apps/<app>/`, but its env file is kept at the monorepo
 * root so there is one file to manage and one `.gitignore` rule. Next.js,
 * Vitest and Playwright all run with cwd = `apps/<app>/` and would otherwise
 * never see it — every config in each app calls this loader first.
 *
 * Behaviour:
 * - Never overrides a var already in `process.env` (CI secrets / Firebase App
 *   Hosting env win over the local file) — but treats an empty string as unset,
 *   since CI/shells often export a placeholder `KEY=` before populating the
 *   secret.
 * - No-ops cleanly when the file is absent (CI, App Hosting — env comes from
 *   the platform).
 * - Rewrites a relative `FIREBASE_SERVICE_ACCOUNT_PATH` to an absolute path
 *   resolved against the repo root, so `firebaseAdmin.ts` `existsSync()` finds
 *   the service account file no matter the process cwd.
 */
export function loadRootEnv(): void {
  const repoRoot = findRepoRoot();
  if (!repoRoot) return;

  const envFile = path.join(repoRoot, ".env");
  if (!existsSync(envFile)) return;

  let loadedServiceAccountPath = false;
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    // never override already-set vars — but treat empty string as unset, since
    // CI/shells often export placeholder `KEY=` before populating the secret.
    const existing = process.env[key];
    if (existing !== undefined && existing !== "") continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
    if (key === "FIREBASE_SERVICE_ACCOUNT_PATH") loadedServiceAccountPath = true;
  }

  // The service account path in `.env` is written relative to the repo root;
  // make it absolute so it resolves no matter where the process was started.
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (loadedServiceAccountPath && serviceAccountPath && !path.isAbsolute(serviceAccountPath)) {
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = path.resolve(repoRoot, serviceAccountPath);
  }
}
