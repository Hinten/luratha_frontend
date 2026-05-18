# Plano: App de administração (monorepo multi-app)

Status: **aprovado** — branch `claude/plan-admin-app-uYvil`.

## Context

PR #102 (`feat(shipping)`) introduziu o documento Firestore `settings/global`
(`siteSettings`): provider de frete, `originPostalCode`, divisor de frete grátis,
tabela `fixedRate`. Hoje essa configuração **só pode ser alterada editando o Firestore
na mão** — não há interface operacional. O mesmo vale, no futuro, para catálogo,
pedidos e cupons.

A solução: um **app de administração separado** que (1) compartilha código com a loja
sem duplicação, (2) roda num **backend de App Hosting próprio** isolado da storefront,
e (3) serve de base para gestão operacional. Referência de arquitetura:
`Hinten/next_erp` (Turborepo + workspaces, `apps/*` + `packages/*`).

Resultado pretendido: storefront e admin como apps independentes num monorepo, com
deploy/escala/incidentes isolados, e um editor de Site Settings funcionando como v1.

## Decisões (confirmadas com o usuário)

| Tema | Decisão |
|---|---|
| Tooling de monorepo | **pnpm + Turborepo** |
| Deploy do admin | Backend de App Hosting separado + subdomínio `admin.luratha.com.br` |
| Escopo v1 | Editor de Site Settings (`settings/global`), sobre a base de auth/shell |
| Sessão loja/admin | **Separada** — cookie `__session` host-only, sem `domain` |

**pnpm sobre npm**: num monorepo multi-app, pnpm impede "phantom dependencies" — o
`apps/admin` só importa o que declarou, reforçando o isolamento pedido. Store
endereçável por conteúdo (instala rápido no container efêmero e no CI), workspaces
nativos (`workspace:*`), e é o que o `next_erp` usa. Firebase App Hosting suporta pnpm
via `packageManager` + `pnpm-lock.yaml`.

## Estado atual relevante

- App único Next.js 16.2.6 / React 19, raiz do repo é o app. `firebase.json` tem
  `apphosting` como **objeto único** (`backendId: luratha-app-frontend`, `rootDir: /`).
- `.firebaserc` → projeto `luratha-96386`. `apphosting.yaml` na raiz.
- `src/lib/auth/requireUser.ts` já lê a custom claim `admin` (`decoded.admin === true`)
  e expõe `requireUser()`, `requireOwnerOrAdmin()`, `AuthError`. **Reusar, não recriar.**
- `firestore.rules` já usa `isAdmin()` (claim `admin`) para escrita de catálogo,
  pedidos, cupons.
- Sessão: `src/app/api/auth/session/route.ts` cria o cookie `__session`. Reusar.
- Schemas Zod em `src/schemas/firestore/`; SDK/converters em `src/lib/firestore/`;
  repositories em `src/lib/repositories/`. Alias atual `@/*`.
- `siteSettings` **NÃO existe em `master`** — vive na branch da PR #102 (draft).
- Hook `SessionStart` (`.claude/settings.json`) roda `npm ci`; CI (`test.yml`) usa
  `cache: npm` + `npm ci`. Ambos precisam migrar para pnpm.

## Layout-alvo

```
luratha_frontend/
├── apps/
│   ├── store/                 # storefront atual (rotas públicas de src/app/)
│   │   ├── src/app/  next.config.ts  apphosting.yaml  package.json
│   └── admin/                 # NOVO app de administração
│       ├── src/app/  middleware.ts  next.config.ts  apphosting.yaml  package.json
├── packages/
│   ├── schemas/               # de src/schemas/firestore
│   ├── firestore/             # de src/lib/firestore (clients + converters)
│   ├── repositories/          # de src/lib/repositories
│   ├── core/                  # constants, errors, types, query strategies, embeddings
│   ├── auth/                  # requireUser, sessão, gate da claim admin
│   ├── ui/                    # design-system + tokens (globals.css)
│   └── config/                # eslint / tsconfig / tailwind compartilhados
├── functions/                 # inalterado
├── firebase.json  turbo.json  pnpm-workspace.yaml  package.json (raiz workspace)
```

Pacotes importados por nome (`@luratha/schemas`, …), mantidos como TS source-only e
declarados em `transpilePackages` no `next.config.ts` de cada app; cada app mantém
`@/*` para o próprio `src`. `outputFileTracingRoot` aponta para a raiz (tracing do
App Hosting). Os módulos `import "server-only"` de `firestore`/`auth` continuam
válidos; adicionar ao alias `server-only` já presente nos `vitest.config`.

## Fases de execução (cada fase = 1 PR)

**Fase 0 — Prereqs.** Mergear PR #102 (traz `siteSettings`); confirmar como a claim
`admin` é provisionada (script/Function) — se não existir, criar um script
`set-admin-claim`. Fases 1–3 não dependem disto e podem começar já.

**Fase 1 — Esqueleto monorepo (alto risco, PR isolado).**
- `pnpm-workspace.yaml`, `turbo.json`, `package.json` raiz; migrar
  `package-lock.json` → `pnpm-lock.yaml`.
- Mover storefront para `apps/store/` (rotas, components, lib, etc.), `next.config.ts`
  e `apphosting.yaml` para dentro do app.
- `firebase.json`: `apphosting` vira **array**, primeira entrada
  `{backendId: luratha-app-frontend, rootDir: apps/store}`.
- Atualizar hook `SessionStart` (`pnpm install --frozen-lockfile`), `test.yml`
  (`pnpm/action-setup`), allowlist de permissões em `.claude/settings.json`.
- **Atualizar `CLAUDE.md`**: secção `Commands` (`npm run *` → `pnpm` / `turbo run *`),
  `Directory Map` (passa a descrever `apps/*` + `packages/*`), `Mandatory order`
  (comandos turbo), e a nota de `vitest.config` server-only.
- **Zero mudança de comportamento.** Tratar a quebra pré-existente de `typedRoutes`
  em `src/app/login/page.tsx` ao reorganizar rotas.

**Fase 2 — Pacotes compartilhados.** Extrair `schemas`, `firestore`, `repositories`,
`core`, `auth`, `ui` de forma incremental, ajustando imports para `@luratha/*`.

**Fase 3 — Scaffold do admin.** `apps/admin`: app Next.js; `login/` reusando o fluxo
de session-cookie de `packages/auth`; `middleware.ts` exigindo `__session` + claim
`admin === true` (reusa `requireUser()`); shell com nav lateral + dashboard mínimo;
layout com `noindex`. Tema reusando tokens de `packages/ui`. Acrescentar `apps/admin`
e a convenção de CRUD API do admin ao `Directory Map` / secção CRUD do `CLAUDE.md`.
- **Sessão separada (decisão confirmada).** O admin reusa o handler de
  `src/app/api/auth/session/route.ts`, que já cria o cookie `__session` **sem
  atributo `domain`** (host-only) — separação é o comportamento padrão. Regra a
  manter: **nunca** definir `domain: ".luratha.com.br"`. Mesmo projeto Firebase →
  pool de usuários e claim `admin` compartilhados; sessão e login independentes por
  subdomínio (IndexedDB do client SDK também é por-origem).

**Fase 4 — Editor de Site Settings (bloqueada pela Fase 0).**
- Tela `apps/admin/src/app/configuracoes` lê `settings/global` via repositório de
  `siteSettings` (`packages/repositories`).
- Formulário: `providerId`, `originPostalCode`, `enabledServices[]`,
  `fallbackProductWeightKg`, `cacheTtlSeconds`; bloco `freeShipping`; tabela
  `fixedRate` (`entries[]` + `defaultEntry`).
- Route handler do admin `PATCH /api/settings` com `export const runtime = "nodejs"`,
  protegido por `requireUser()` + `isAdmin`, validação Zod (`error.issues`), semântica
  PATCH `{...existing, ...payload, ...serverFields}`, `forceFresh` no cache.
  Seguir skill `luratha-crud-api` (`.withConverter()`, sem catch genérico, strip de
  campos computados por `transform`).

**Fase 5 — Infra + CI.** Segunda entrada `apphosting` em `firebase.json`
(`backendId: luratha-app-admin, rootDir: apps/admin`); criar o backend
(`firebase apphosting:backends:create`), subdomínio `admin.luratha.com.br` (DNS +
domínio custom), env/secrets do backend admin. Matriz de `test.yml` passa a rodar
`turbo run lint test build` por app. Atualizar docs: `CLAUDE.md` (CI matrix, deploy
dos dois backends), `README.md` e `docs/admin-app-plan.md`.

## Arquivos críticos a tocar

- `firebase.json` — `apphosting` objeto → array de 2 backends.
- `package.json` (raiz), novo `pnpm-workspace.yaml`, `turbo.json`, `pnpm-lock.yaml`.
- `.claude/settings.json` — hook `SessionStart` + allowlist (npm → pnpm).
- `.github/workflows/test.yml` — setup pnpm + comandos turbo.
- `CLAUDE.md` — `Commands`, `Directory Map`, `Mandatory order`, CRUD API layout,
  CI matrix; `README.md` — instruções de setup/deploy multi-app.
- `next.config.ts`, `apphosting.yaml`, `tsconfig.json` — movidos/divididos por app.
- Tudo em `src/` — redistribuído entre `apps/store` e `packages/*`.
- Reusar sem reescrever: `src/lib/auth/requireUser.ts`,
  `src/app/api/auth/session/route.ts`.

## Riscos

- **PR #102 (draft) bloqueia a Fase 4** — `siteSettings` não está em `master`.
- **Provisão da claim `admin`** precisa existir antes da Fase 3.
- **Fase 1 é a mais arriscada**: muda imports/build/CI sem mudar comportamento — PR
  isolado, revisado com cuidado.
- App Hosting monorepo é suportado via `rootDir`, mas cada app precisa do próprio
  `apphosting.yaml` + `next.config.ts` com `outputFileTracingRoot`.
- Sessões separadas loja/admin: viável e padrão — o cookie `__session` é criado
  host-only (sem `domain`) em `src/app/api/auth/session/route.ts:75`. Mesmo projeto
  Firebase compartilha só o pool de usuários e a claim `admin`, não a sessão. Risco a
  evitar: introduzir `domain` no cookie, o que ligaria SSO sem querer.

## Verificação

- Por fase, ordem do CLAUDE.md via Turborepo: `turbo run typecheck` →
  `turbo run lint` → `turbo run test` → `turbo run test:e2e`.
- Fase 1: build/test/e2e da storefront verdes **sem diff de comportamento**;
  install pnpm limpo no container e no CI.
- Fase 3: login no admin com usuário sem claim `admin` → bloqueado/redirecionado;
  com claim → acessa o shell.
- Fase 4: editar `settings/global` na UI → `PATCH /api/settings` → reler do Firestore
  e confirmar persistência; `test:firestore` no app afetado. Cobrir o route handler e
  o form com testes unitários/cloud.
- Fase 5: deploy dos dois backends; `luratha.com.br` e `admin.luratha.com.br`
  respondendo de forma independente.
