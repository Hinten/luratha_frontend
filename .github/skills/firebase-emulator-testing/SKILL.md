---
name: firebase-emulator-testing
description: Use esta skill para implementar e validar testes de integração com Firebase Emulator (Firestore/Auth/Storage), incluindo detecção de emulator ativo, startup automático com timeout, estratégia de skip, cleanup de dados, scripts com firebase emulators:exec e boas práticas de CI/CD.
compatibility: Firebase CLI, Firebase JS SDK v12, Vitest, Node.js 22, Next.js 16
---

# Firebase Emulator Testing — Luratha

## Objetivo

Padronizar como criar testes de integração para Firestore com segurança, previsibilidade e boa performance.

## 1) Configuração correta do Firebase Emulator

Pré-requisitos:

```bash
npm ci
npm install -g firebase-tools@latest
firebase setup:emulators:firestore
```

Configuração local esperada (`firebase.json`):

- Firestore: `8080`
- Auth: `9099`
- Storage: `9199`

## 2) Como verificar se o emulator está rodando (código reutilizável)

Use utilitário Node para verificar porta (`net.createConnection`) e expor função:

- `ensureFirestoreEmulator()`

Fluxo recomendado:

1. Tenta conectar em `FIRESTORE_EMULATOR_HOST`.
2. Se falhar, inicia `firebase emulators:start --only firestore`.
3. Aguarda até timeout.
4. Retorna status para `describe` ou `describe.skip`.

## 3) Estratégia recomendada: skip vs iniciar automaticamente

- **Dev local:** tentar subir automaticamente para reduzir fricção.
- **CI:** preferir `firebase emulators:exec` (determinístico).
- **Fallback obrigatório:** se timeout estourar, usar `describe.skip` e logar motivo.

## 4) Boas práticas para escrever testes com emulator

- Use `@vitest-environment node` para testes de integração Firebase.
- Injete dependências (ex.: `createProductsRepository(db)`).
- Valide payloads com schema (Zod) antes de persistir.
- Cubra:
  - Create
  - Read
  - Update
  - Delete
  - Casos de borda (not_found, conflito, validação).

## 5) `firebase emulators:exec` no package.json

Exemplo:

```json
"test:firestore": "firebase emulators:exec --only firestore \"vitest run src/lib/__tests__/productsRepository.emulator.test.ts\""
```

Benefícios:

- sobe/derruba emulator automaticamente;
- reduz flakes;
- ideal para pipeline CI.

## 6) Configuração do SDK para apontar para emulator

No frontend (`src/lib/firebase.ts`):

- `NEXT_PUBLIC_USE_EMULATOR=true`
- `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
- `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`
- `NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`

No Vitest (`vitest.config.mts`):

- `FIREBASE_PROJECT_ID`
- `FIRESTORE_EMULATOR_HOST`
- `FIREBASE_AUTH_EMULATOR_HOST`
- `FIREBASE_STORAGE_EMULATOR_HOST`

## 7) Clean up, performance e CI/CD

- Limpe coleção(s) antes de cada teste (`clearFirestoreCollection`).
- Evite dados desnecessários: seed curto e objetivo.
- Pré-baixe emulator no setup de CI:

```yaml
- run: firebase setup:emulators:firestore
```

## 8) Dicas avançadas

- **Auth Emulator:** valide login/claims em fluxos reais.
- **Storage Emulator:** valide upload e metadados.
- **Rules testing:** inclua testes de security rules (allow/deny).
- **Ambientes isolados:** use project IDs de teste dedicados.

## 9) Exemplo prático (baseado no código atual)

- Repositório: `src/lib/repositories/productsRepository.ts`
- Mock/seed: `src/lib/repositories/productsMockData.ts`
- Utilitário emulator: `src/test/firestoreEmulator.ts`
- Teste integração: `src/lib/__tests__/productsRepository.emulator.test.ts`

## 10) Problemas comuns e fixes

- **ECONNREFUSED**: emulator não iniciado ou host incorreto.
- **Timeout de startup**: aumentar timeout e pré-baixar binário.
- **Validação Zod quebrando update**: garantir consistência entre variantes/estoque/preço.
- **Flakes em CI**: usar `firebase emulators:exec` ao invés de start manual.
