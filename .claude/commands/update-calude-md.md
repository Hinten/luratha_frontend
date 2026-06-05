---
description: Explore the repository and propose surgical updates to CLAUDE.md, trimming whatever is redundant or out of date.
allowed-tools: Bash, Read, Glob, Grep, Edit
---

# Review and update CLAUDE.md

Your goal is to keep `CLAUDE.md` **lean, accurate, and useful**. A good `CLAUDE.md` describes only what isn't obvious from the code and what changes the behavior of someone working in the repo. Anything redundant, out of date, or inferable in 5 seconds by glancing at the project should be cut.

Extra focus: $ARGUMENTS

## 1. Establish the real state of the repository

Before touching anything, investigate (don't trust what CLAUDE.md claims — verify it):

- Relevant folder structure (ignore `node_modules`, `.next`, `dist`, build artifacts).
- Actual package manager and scripts: read `package.json` (`scripts`, `packageManager`), the lockfile, `pnpm-workspace.yaml` if present.
- The toolchain that's actually configured: presence of `biome.json`, `vitest.config.*`, `playwright.config.*`, `tsconfig.json` (and whether `strict` is on), lint/format configs.
- Build/test/lint commands that genuinely exist and work.
- Conventions visible in the code (import structure, component patterns, feature-folder organization).
- Integrations/infra referenced in config (Firebase, CI under `.github/workflows`, etc.).

## 2. Compare against the current CLAUDE.md

Read the entire `CLAUDE.md` and classify each block as:

- **CORRECT AND USEFUL** → keep as is.
- **OUT OF DATE** → the repo changed; fix it to reflect reality.
- **REDUNDANT/OBVIOUS** → inferable straight from the code or config; remove.
- **VAGUE/NON-ACTIONABLE** → generic advice that doesn't change behavior ("write clean code"); remove or make concrete.
- **MISSING** → something non-obvious that would surprise a new contributor (or you) and isn't documented.

## 3. Propose the diff — don't overwrite

Present the changes **before** applying them:

- Show what's removed, what's added, and why for each change, concisely.
- Prioritize **cutting**: if the file shrinks while keeping the signal, that's a win.
- Preserve any intentional user instruction even if it looks unusual (tooling preferences, deliberate architecture decisions) — when in doubt, ask rather than remove.
- Keep a direct tone, no decorative headers and bullets. Every line in CLAUDE.md must earn its space.

Only apply the edits after I confirm. If something is ambiguous (an architecture decision you can't confirm from the code), list it as a question instead of guessing.
