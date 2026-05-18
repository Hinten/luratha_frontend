# Plano: App de administração (multi-app monorepo)

Status: proposta — branch `claude/plan-admin-app-uYvil`.

## 1. Motivação

PR #102 (`feat(shipping)`) introduziu o documento `settings/global` (`siteSettings`) —
provider de frete, `originPostalCode`, divisor de frete grátis, tabela `fixedRate`.
Hoje essa configuração só pode ser alterada **editando o Firestore na mão**. Falta
uma interface operacional. A solução é um **app de administração separado** que:

- compartilha schemas / repositories / SDK Firebase com a loja, sem duplicação;
- roda num **backend de App Hosting próprio**, isolado da storefront (deploy, escala
  e incidentes do admin não afetam a loja);
- é a base para gerir catálogo, pedidos e cupons no futuro.

Referência de arquitetura: `Hinten/next_erp` (Turborepo + workspaces, `apps/*` +
`packages/*`).

## 2. Decisões já tomadas

| Tema | Decisão |
|---|---|
| Tooling de monorepo | **pnpm + Turborepo** (ver §3) |
| Deploy do admin | **Backend de App Hosting separado + subdomínio** `admin.luratha.com.br` |
| Escopo v1 | **Editor de Site Settings** (`settings/global`) — sobre a base de auth/shell |

## 3. pnpm vs npm — recomendação: pnpm

Para um monorepo multi-app, **pnpm é a melhor escolha**, e o projeto ainda é WIP:

- **Isolamento real de dependências.** pnpm não permite "phantom dependencies": o
  `apps/admin` só consegue importar pacotes que declarou. Isso reforça diretamente o
  objetivo "o admin não mexe com a loja".
- **Workspaces nativos** com protocolo `workspace:*` para linkar `packages/*`.
- **Store endereçável por conteúdo** → instalações muito mais rápidas e menos disco
  (importa no container efêmero da nuvem e no CI).
- **Consistência com `next_erp`**, a referência pedida.
- **Firebase App Hosting suporta pnpm** (detecta via campo `packageManager` +
  `pnpm-lock.yaml`).

Custo (único, contido): migrar `package-lock.json` → `pnpm-lock.yaml`, atualizar o
hook `SessionStart` (`npm ci` → `pnpm install --frozen-lockfile`), o CI (`cache: npm`
→ `pnpm/action-setup`) e o allowlist de permissões. Turborepo entra para orquestrar
e cachear `lint`/`test`/`build` só nos apps afetados.

## 4. Layout-alvo do monorepo

```
luratha_frontend/
├── apps/
│   ├── store/                 # storefront atual (todo o conteúdo público)
│   │   ├── src/app/           # rotas públicas movidas de src/app/
│   │   ├── next.config.ts
│   │   ├── apphosting.yaml    # backend luratha-app-frontend
│   │   └── package.json
│   └── admin/                 # NOVO app de administração
│       ├── src/app/
│       ├── next.config.ts
│       ├── apphosting.yaml    # backend luratha-app-admin
│       └── package.json
├── packages/
│   ├── schemas/               # de src/schemas/firestore — Zod + collections
│   ├── firestore/             # de src/lib/firestore — SDK clients + converters
│   ├── repositories/          # de src/lib/repositories
│   ├── core/                  # constants, errors, types, query strategies, embeddings
│   ├── auth/                  # requireUser, sessão, gate de claim admin
│   ├── ui/                    # componentes de design-system + tokens (globals.css)
│   └── config/                # eslint / tsconfig / tailwind compartilhados
├── functions/                 # inalterado
├── firebase.json              # apphosting vira ARRAY de 2 backends
├── turbo.json
├── pnpm-workspace.yaml
└── package.json               # raiz do workspace (sem deps de runtime)
```

Pacotes importados por nome (`@luratha/schemas`, `@luratha/firestore`, …). Cada app
mantém o alias `@/*` para o próprio `src`. Pacotes ficam como **TS source-only** e
cada app os declara em `transpilePackages` no `next.config.ts`. `outputFileTracingRoot`
aponta para a raiz do monorepo para o tracing do App Hosting funcionar.

`packages/firestore` e `packages/auth` contêm módulos `import "server-only"` —
permanecem válidos dentro dos apps Next; os `vitest.config` ganham o alias de
`server-only` já existente.

## 5. firebase.json — dois backends de App Hosting

`apphosting` passa de objeto para array:

```jsonc
"apphosting": [
  {
    "backendId": "luratha-app-frontend",
    "rootDir": "apps/store",
    "ignore": ["node_modules", ".git", "**/__tests__", "e2e", "..."]
  },
  {
    "backendId": "luratha-app-admin",
    "rootDir": "apps/admin",
    "ignore": ["node_modules", ".git", "**/__tests__", "..."]
  }
]
```

Passos de infra (fora do código, exigem acesso ao console Firebase/GCP):
1. `firebase apphosting:backends:create` para `luratha-app-admin`.
2. Apontar o subdomínio `admin.luratha.com.br` (DNS + domínio custom no App Hosting).
3. Configurar env/secrets do backend admin (`FIREBASE_SERVICE_ACCOUNT_BASE64`, etc.).

Isolamento de sessão: o cookie reservado `__session` é por-origem. Loja em
`luratha.com.br` e admin em `admin.luratha.com.br` → cookies separados, logins
independentes. O admin gere o próprio fluxo de sessão.

## 6. App de administração — v1

### 6.1 Auth e shell (base obrigatória do v1)

- Página de login (`apps/admin/src/app/login`) reusando o fluxo de session-cookie já
  existente (`src/app/api/auth/session/route.ts`), extraído para `packages/auth`.
- `middleware.ts` no admin: valida `__session` e exige a custom claim `admin === true`
  (já lida por `requireUser()` em `src/lib/auth/requireUser.ts`). Sem a claim →
  redireciona para login / 403.
- Shell: layout com navegação lateral e dashboard mínimo. Tema próprio, mais sóbrio,
  reutilizando os tokens de `packages/ui` (skill `visual-identity`).
- **Pré-requisito:** confirmar como a claim `admin` é provisionada (script/Function).
  Se não existir, adicionar um script `set-admin-claim` em `functions/` ou `scripts/`.

### 6.2 Editor de Site Settings (feature v1)

Depende de **PR #102 estar mergeado** (traz o schema `siteSettings`, o repositório com
cache e `settings/global`). Enquanto #102 for draft, este passo fica bloqueado — ver §8.

- Tela `apps/admin/src/app/configuracoes` lê `settings/global` via o repositório de
  `siteSettings` (em `packages/repositories`).
- Formulário para editar: `providerId`, `originPostalCode`, `enabledServices[]`,
  `fallbackProductWeightKg`, `cacheTtlSeconds`; bloco `freeShipping`
  (`divisor`/`minThreshold`/`maxThreshold`/`enabled`); tabela `fixedRate`
  (`entries[]` + `defaultEntry`).
- Route handler do **próprio app admin** `PATCH /api/settings` com
  `export const runtime = "nodejs"`, protegido por `requireUser()` + `isAdmin`,
  validação Zod (`error.issues`), semântica PATCH `{...existing, ...payload,
  ...serverFields}` e invalidação de cache (`forceFresh`).
- Convenções da skill `luratha-crud-api`: `.withConverter()`, sem catch genérico,
  strip de campos computados por `transform` antes de revalidar.

## 7. Fases de execução (cada fase = 1 PR)

| Fase | Entrega | Risco |
|---|---|---|
| **0. Prereqs** | Mergear PR #102; confirmar provisão da claim `admin` | — |
| **1. Esqueleto monorepo** | pnpm workspace + Turborepo; mover storefront para `apps/store`; CI/hook migrados; **zero mudança de comportamento**; build/test/e2e verdes | **Alto** — PR isolado e revisado com cuidado |
| **2. Pacotes compartilhados** | Extrair `schemas`, `firestore`, `repositories`, `core`, `auth`, `ui` de forma incremental | Médio |
| **3. Scaffold do admin** | `apps/admin`: login + middleware (gate da claim) + shell/dashboard | Médio |
| **4. Editor de Site Settings** | Feature §6.2 + `PATCH /api/settings` + testes | Baixo |
| **5. Infra + CI** | 2º backend App Hosting, subdomínio, matriz de CI por app, docs | Médio |

A Fase 1 é a mais arriscada: muda imports, build e CI sem mudar comportamento.
Deve ir sozinha num PR, validada por `npx tsc` → `lint` → `test` → `test:e2e`.

## 8. Dependências e riscos

- **PR #102 (draft) bloqueia a Fase 4.** O schema `siteSettings` vive na branch
  `claude/flexible-shipping-provider-BMUjr`, não em `master`. Fases 1–3 não dependem
  dele e podem começar já.
- **Provisão da claim `admin`** precisa existir antes da Fase 3 — verificar.
- **App Hosting monorepo**: suportado via `rootDir`; cada app precisa do próprio
  `apphosting.yaml` e `next.config.ts` com `outputFileTracingRoot` na raiz.
- **CI**: a matriz de `test.yml` passa a rodar `turbo run lint test build` e os suites
  cloud por app. O job `report-failure` continua válido.
- **`typedRoutes`**: hoje o build quebra em `src/app/login/page.tsx` (Next 16) — issue
  pré-existente; tratar durante a Fase 1 ao reorganizar as rotas.

## 9. Verificação por fase

Ordem obrigatória do CLAUDE.md, agora via Turborepo:
`turbo run typecheck` → `turbo run lint` → `turbo run test` → `turbo run test:e2e`.
Mudanças de schema/Firebase: `test:firestore` no app afetado. SEO: cada rota nova do
admin é interna (`robots`/sitemap não expõem o admin; `noindex` no layout do admin).
