# Firestore CRUD + Emulator (Products)

Este guia descreve a camada de CRUD criada para `src/schemas/firestore/products.ts`, como executar os testes de integração no Firebase Emulator e como usar o setup em CI/CD.

## Arquivos principais

- Repositório CRUD: `src/lib/repositories/productsRepository.ts`
- Mock data para seed: `src/lib/repositories/productsMockData.ts`
- Utilitários de emulator para testes: `src/test/firestoreEmulator.ts`
- Testes de integração: `src/lib/__tests__/productsRepository.emulator.test.ts`

## Camada CRUD implementada

`createProductsRepository(db)` expõe:

- `create(input)`
- `getById(id)`
- `update(id, patch)`
- `delete(id)`
- `list(filters)`
- `seedMockProducts(products)`

### Regras importantes

- Todos os documentos passam por `validateProduct` (schema Zod).
- Erros são normalizados com `ProductRepositoryError` e códigos:
  - `validation`
  - `not_found`
  - `conflict`
  - `unknown`
- `update` sempre recalcula e valida o documento completo antes de persistir.
- `list` usa filtros e `limit` com teto (`MAX_LIST_LIMIT`) para evitar consultas excessivas.

## Estratégia de testes com emulator

No arquivo de teste, a estratégia é:

1. Verificar se o Firestore Emulator está ativo (`host:port`).
2. Se não estiver, tentar subir automaticamente via `firebase emulators:start --only firestore`.
3. Aguardar até timeout.
4. Se timeout estourar, o bloco inteiro usa `describe.skip`.

Isso está implementado com:

- `ensureFirestoreEmulator(...)`
- `stopFirestoreEmulator(...)`
- `clearFirestoreCollection(...)`

## Limpeza de dados entre testes

- Antes de cada teste: limpeza da coleção `products`.
- Após a suíte: limpeza final + encerramento do emulator quando ele foi iniciado pelo próprio teste.

## Scripts recomendados

`package.json` inclui:

```json
"test:firestore": "firebase emulators:exec --only firestore --project luratha-96386 --config firebase.json --non-interactive \"node ./node_modules/vitest/vitest.mjs run src/lib/__tests__/productsRepository.emulator.test.ts\""
```

Uso:

```bash
npm run test:firestore
```

> Não é necessário autenticar com `firebase login` para executar o Firestore Emulator localmente.

## Configuração de ambiente para testes

`vitest.config.mts` define, por padrão:

- `FIREBASE_PROJECT_ID=luratha-96386`
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
- `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`
- `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`

## SDK apontando para Emulator

`src/lib/firebase.ts` agora exporta:

- `auth`
- `db`
- `storage`

Quando `NEXT_PUBLIC_USE_EMULATOR=true` no browser:

- conecta Auth Emulator
- conecta Firestore Emulator
- conecta Storage Emulator

Hosts podem ser customizados com:

- `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST`
- `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST`
- `NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST`

## CI/CD e setup do ambiente

`.github/workflows/copilot-setup-steps.yml` foi atualizado para pré-baixar o Firestore Emulator:

```yaml
- name: Pre-download Firestore Emulator
  run: firebase setup:emulators:firestore
```

Isso reduz falhas por download tardio durante testes.

## Casos cobertos na integração

- Create
- Read
- Update
- Delete
- List com filtro
- Validação Zod (payload inválido)
- Conflito de ID duplicado
- Not found em update

## Problemas comuns e correções

- **Erro de conexão**: confirme `FIRESTORE_EMULATOR_HOST` e porta `8080`.
- **Emulator não sobe no CI**: valide Java no runner e execute `firebase setup:emulators:firestore` no setup.
- **Testes lentos**: execute via `firebase emulators:exec` e mantenha limpeza por coleção com lotes pequenos.
- **Falha de validação**: garanta consistência entre `priceMin/priceMax`, variantes, `totalStock` e embeddings.
