import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Walks up from `process.cwd()` looking for the monorepo root, identified by
 * `pnpm-workspace.yaml`. Returns `null` when no marker is found (e.g. a
 * standalone production build) — callers treat that as "no local `.env`".
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
 * The admin app lives in `apps/admin/`, but the env file is kept at the
 * monorepo root so there is one file to manage. Next.js runs with
 * cwd = `apps/admin/` and would otherwise never see it.
 *
 * - Never overrides a var already in `process.env` (platform env wins).
 * - No-ops cleanly when the file is absent (CI, App Hosting).
 * - Rewrites a relative `FIREBASE_SERVICE_ACCOUNT_PATH` to an absolute path.
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
    // Sobrescreve quando a env veio vazia do shell/CI (ex.: `KEY=` exportado
    // como placeholder antes do secret ser populado). `in` retorna true pra
    // string vazia também, então tratamos vazio como ausente.
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

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (loadedServiceAccountPath && serviceAccountPath && !path.isAbsolute(serviceAccountPath)) {
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = path.resolve(repoRoot, serviceAccountPath);
  }
}
