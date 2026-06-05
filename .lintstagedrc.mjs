import path from "node:path";

/** Double-quote a path for safe shell interpolation. */
const quote = (p) => `"${p}"`;

/**
 * lint-staged config for the pnpm + Turborepo monorepo.
 *
 * ESLint uses per-package flat configs (each `apps/*` and `packages/*` owns its
 * own `eslint.config.mjs`), and ESLint 9 resolves its config from the current
 * working directory — so a single `eslint` run from the repo root can't see
 * them. We group staged sources by workspace and run `eslint --fix` with that
 * workspace as the cwd, then format. Prettier always runs fine from the root.
 *
 * `functions/` has its own npm toolchain outside the workspace, so it's only
 * formatted here (its ESLint runs in its own `npm run lint` / CI).
 */
export default {
  "{apps,packages}/**/*.{ts,tsx,mts}": (files) => {
    const byWorkspace = new Map();
    for (const file of files) {
      const rel = path.relative(process.cwd(), file);
      const match = rel.match(/^((?:apps|packages)\/[^/]+)\//);
      if (!match) continue;
      const workspace = match[1];
      const list = byWorkspace.get(workspace) ?? [];
      list.push(path.relative(workspace, rel));
      byWorkspace.set(workspace, list);
    }
    const commands = [];
    for (const [workspace, workspaceFiles] of byWorkspace) {
      commands.push(
        `sh -c 'cd ${workspace} && eslint --fix --max-warnings 0 ${workspaceFiles
          .map(quote)
          .join(" ")}'`,
      );
    }
    commands.push(`prettier --write ${files.map(quote).join(" ")}`);
    return commands;
  },
  "functions/**/*.{ts,js}": "prettier --write",
  "*.{js,cjs,mjs,json,css,md,yml,yaml}": "prettier --write",
};
