# Plan: Busca de Produtos com Pipeline + Vetor

Implementar busca em duas superfícies (global e por categoria) usando Pipeline Queries + Vector Search no Firestore Enterprise, com fallback automático para Core Query. Para testes, manter o fluxo local com emulador e criar uma suíte para teste cloud separada, acionada manualmente por comando `npm run test:cloud`.

## Decisões Fechadas

| Item                            | Decisão                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| Provedor de embedding           | Vertex AI                                                       |
| Fallback                        | Obrigatório para Core Query quando Pipeline/Vector indisponível |
| Superfícies de busca            | Ambas: global em `/busca` e contextual em `/categoria/[slug]`   |
| Testes cloud                    | Somente manual via `npm run test:cloud`                         |
| Tipo de embeddings dos produtos | Pré-computados em seed + atualização incremental                |

---

## Fase 1 — Contrato e Estratégia de Execução

**Objetivo:** consolidar os tipos e a regra de roteamento entre os três caminhos de busca antes de qualquer implementação.

### 1.1 Contratos de entrada/saída

- Revisar `src/schemas/firestore/search.ts`: validação de `PipelineSearchRequest` e `VectorSearchRequest` já existem; confirmar se cobrem busca global e por categoria.
- O Limite de dimensões do vetor da firebase é de 2048, fazer os ajustes necessários para garantir compatibilidade com o embedding do Vertex AI (ex.: truncamento, redução de dimensionalidade).
- Revisar `src/lib/firestoreQueryStrategies.ts`: `ProductSearchFilters` já inclui `term`, `categorySlug`, `minPrice`, `maxPrice`, `tags`, `limit`, `offset`, `sort`. Confirmar compatibilidade com os dois contextos de rota.
- Confirmar que `shouldUsePipeline()` encobre a lógica de desvio: retorna `true` se `term` não vazio ou se `tags.length > 4`.

### 1.2 Regra de roteamento

```
entrada: ProductSearchFilters
  ↓
shouldUsePipeline(filters)?
  ├── true  → embeddingService disponível?
  │           ├── true  → Vector Pipeline
  │           └── false → Pipeline textual (regex)
  └── false → Core Query
```

### 1.3 Política de fallback

- Qualquer erro em Vector Pipeline → tentar Pipeline textual.
- Qualquer erro em Pipeline textual → Core Query.
- Core Query não produz resultado vazio silencioso; propaga erro com `ProductRepositoryError`.

---

## Fase 2 — Camada de Execução da Busca

**Arquivo novo:** `src/lib/repositories/productsSearchRepository.ts`

Seguir exatamente o padrão de `createProductsRepository`: factory function que recebe `Firestore` (default `dbServer`) e retorna a interface do repositório.

### 2.1 Interface pública

```ts
export interface ProductsSearchRepository {
  search(filters: ProductSearchFilters, options?: SearchOptions): Promise<Product[]>;
}

interface SearchOptions {
  useVectors?: boolean; // false enquanto embeddings não estiverem populados
}
```

### 2.2 Executor Core

- Converter `CoreQueryPlan` (de `buildCoreProductQueryPlan`) em `query(collection, ...where, orderBy, limit)` + `getDocs()`.
- Replicar o mapeamento de documento para `Product` já usado em `productsRepository`.

### 2.3 Executor Pipeline textual

- Importar `execute` de `firebase/firestore/pipelines` (disponível no `firebase@^12.11.0` já instalado).
- Converter `PipelineQueryPlan` (de `buildEnterprisePipelineSearchPlan`) em chamadas de pipeline usando as funções declarativas do SDK.
- Usar projeção (`select`) para reduzir payload e custo.

### 2.4 Executor vetorial

- Receber embedding como `number[]` já gerado pelo serviço (Fase 3).
- Converter `VectorPipelinePlan` (de `buildEnterpriseVectorSearchPlan`) em pipeline com estágio de busca vetorial.
- O campo `score` deve ser incluído no retorno para futura ordenação por relevância.

### 2.5 Fallback encapsulado

```ts
async function search(filters, options = {}) {
  if (options.useVectors && filters.term) {
    try {
      const embedding = await embeddingService.embed(filters.term);
      return await executeVector(embedding, filters);
    } catch {
      // fallthrough
    }
  }
  if (shouldUsePipeline(filters)) {
    try {
      return await executePipeline(filters);
    } catch {
      // fallthrough
    }
  }
  return await executeCore(filters);
}
```

### 2.6 Mapeamento canônico

- Extrair a função `mapFirestoreProductToCard` já presente em `src/app/categoria/[slug]/page.tsx` para um arquivo compartilhado (ex.: `src/lib/repositories/productMapper.ts`) para ser reutilizado tanto na busca quanto na categoria.

---

## Fase 3 — Serviço de Embeddings com Vertex AI

**Arquivo novo:** `src/lib/embeddingService.ts`

### 3.1 Integração Vertex AI

- Usar a API `textembedding-gecko` (ou versão mais recente) do Vertex AI via REST ou SDK Google AI.
- Recebe texto (termo de busca) e retorna `number[]` compatível com o schema Zod (`min(8), max(2048)`).

### 3.2 Tratamento de falha

- Timeout configurável; padrão conservador (ex.: 3 segundos).
- Qualquer falha lança erro que o executor da Fase 2 captura e usa como gatilho de fallback.

### 3.3 Backfill do catálogo

- Como este projeto é novo, os embeddings dos produtos não existem ainda. Não é necessário criar esse script.

### 3.4 Atualização incremental

- Aparentemente existe uma extensão da firebase para atualizar embeddings de forma incremental, podemos utilizar ele https://extensions.dev/extensions/googlecloud/firestore-vector-search

---

## Fase 4 — Rotas e UI

### 4.1 Busca por categoria (`src/app/categoria/[slug]/page.tsx`)

Ampliar leitura de `searchParams` com novos parâmetros:

| Parâmetro  | Tipo           | Descrição              |
| ---------- | -------------- | ---------------------- |
| `q`        | `string`       | Termo de busca livre   |
| `sort`     | `string`       | Já existe              |
| `minPrice` | `number`       | Filtro de preço mínimo |
| `maxPrice` | `number`       | Filtro de preço máximo |
| `tags`     | `string` (CSV) | Filtros de tags        |
| `page`     | `number`       | Paginação básica       |

- Substituir chamada `productsRepository.list()` por `productsSearchRepository.search()` com `categorySlug` fixado.
- Preservar React `cache()` para memoização.

### 4.2 Rota de busca global (`src/app/busca/page.tsx`)

- Mesma estrutura de Server Component de `categoria/[slug]/page.tsx`.
- Parâmetros: `q` (obrigatório), `sort`, `minPrice`, `maxPrice`, `tags`, `page`.
- Estado vazio diferenciado: se `q` vazio, mostrar guia de busca; se `q` preenchido sem resultados, mostrar sugestões.
- Breadcrumb: `Home > Busca > "{q}"`.

### 4.3 Input de busca no Header (`src/components/Header.tsx`)

- Criar `src/components/busca/SearchInput.tsx` como `"use client"`.
- Padrão de URL state igual ao `SortDropdown`: `useRouter`, `usePathname`, `useSearchParams`.
- Submit por Enter ou ícone de lupa → `router.push("/busca?q=${term}")`.
- Acessibilidade: `<label htmlFor>` (visualmente oculto), `aria-label`, announce de resultados.

### 4.4 Grid de resultados

- Reutilizar `src/components/categoria/ProductGrid.tsx` sem modificação (já trata empty state).

### 4.5 Acessibilidade

- Um `<h1>` por página com texto dinâmico ("Resultados para: vestido").
- Contagem de resultados em `<p>` com `aria-live="polite"`.
- Foco movido para heading de resultados após submit.
- Todos os controles de filtro com `<label>` explícito.

---

## Fase 5 — SEO/AEO/GEO para `/busca`

### 5.1 Metadata dinâmica

```ts
export async function generateMetadata({ searchParams }) {
  const { q } = await searchParams;
  return {
    title: q ? `Busca: "${q}" | Luratha` : "Buscar | Luratha",
    description: `Encontre peças slow fashion na Luratha${q ? ` relacionadas a "${q}"` : ""}.`,
    alternates: { canonical: `${SITE_URL}/busca${q ? `?q=${encodeURIComponent(q)}` : ""}` },
    openGraph: { ... },
    robots: { index: false }, // evitar indexação de combinações de filtros
  };
}
```

### 5.2 JSON-LD

- Injetar `SearchResultsPage` via `JsonLd` (componente já existente).
- Reutilizar `BreadcrumbList` com o mesmo padrão das páginas de categoria.

### 5.3 Sitemap e robots

- Não adicionar rotas de busca ao `sitemap.ts`.
- Adicionar diretiva no `robots.ts` para `/busca` permitir acesso mas não indexar combinações.

---

## Fase 6 — Testes (Emulador + Cloud)

### 6.1 Suíte local (sem alteração no fluxo obrigatório)

```bash
npm run lint
npm test
npm run test:e2e
npm run test:firestore        # obrigatório: mudança em repositórios Firebase
npm run test:e2e:emulator     # obrigatório: mudança em fluxos Firebase no browser
npm run test:cloud              # opcional: somente se credenciais cloud configuradas localmente
```

### 6.2 Suíte cloud (para pipeline e vetor)

**Arquivos novos:**

```
vitest.cloud.config.mts
src/test/cloudTests.globalSetup.ts
src/test/cloud/
  __README.md
  sharedSetup.ts              # helpers: auth, prefixo de coleção, cleanup
  pipelineSearch.test.ts      # testes de busca textual via pipeline
  vectorSearch.test.ts        # testes de busca vetorial
.github/workflows/cloud-firestore-tests.yml
```

**`vitest.cloud.config.mts`:**

```ts
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["./src/test/cloudTests.globalSetup.ts"],
    include: ["src/test/cloud/**/*.test.ts"],
    testTimeout: 30_000,
    retries: 1,
    env: {
      CLOUD_TEST_PROJECT_ID: process.env.CLOUD_TEST_PROJECT_ID ?? "luratha-test",
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "",
    },
  },
});
```

**`package.json` — novo script:**

```json
"test:cloud": "vitest run --config vitest.cloud.config.mts"
```

### 6.3 Isolamento de dados no projeto cloud

- Prefixo por execução: `__test_${Date.now()}_${randomId}` para todas as coleções criadas.
- Marcar todos os documentos com `{ __isTestData: true }`.
- Cleanup em `afterAll` de cada suite e no teardown global.
- Nunca ler dados fora do prefixo de teste.

### 6.4 Guardas de skip

```ts
// src/test/cloudTests.globalSetup.ts
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "";
if (!credPath || !fs.existsSync(credPath)) {
  process.env.CLOUD_TEST_SKIP_REASON = "GOOGLE_APPLICATION_CREDENTIALS ausente ou inválido";
}

// Em cada arquivo de teste:
const describeCloud = process.env.CLOUD_TEST_SKIP_REASON ? describe.skip : describe;
```

### 6.5 Workflow GitHub Actions

```yaml
# .github/workflows/cloud-firestore-tests.yml
name: Cloud Firestore Tests (Pipeline + Vector)
on:
  workflow_dispatch:

jobs:
  cloud-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - run: npm ci
      - name: Decode service account
        run: |
          echo "${{ secrets.GH_CLOUD_TEST_SA_KEY }}" | base64 -d > /tmp/sa-key.json
          echo "GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa-key.json" >> $GITHUB_ENV
          echo "CLOUD_TEST_PROJECT_ID=${{ vars.CLOUD_TEST_PROJECT_ID }}" >> $GITHUB_ENV
      - run: npm run test:cloud
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: cloud-test-results
          path: test-results/
```

---

## Fase 7 — Índices, Rollout e Observabilidade

### 7.1 Índices (`firestore.indexes.json`)

Existentes (manter):

- `(status, categorySlug, priceMin)`
- `(status, ratingAverage DESC, reviewCount DESC)`
- `(tags CONTAINS, status, updatedAt DESC)`

Novos necessários (confirmar com `gcloud firestore indexes list` após deploy):

- `(status, categorySlug, priceMin, priceMax)` para buscas com range duplo de preço
- Índice vetorial: configurar via Console Firebase no projeto Enterprise (não suportado em `firestore.indexes.json` ainda)

### 7.2 Observabilidade

- Log do caminho de busca executado: `core | pipeline | vector`.
- Log de fallback: quando e por qual motivo foi acionado.
- Latência por caminho.
- Taxa de resultados vazios.

---

## Fase 8 — Validação Final

### Sequência obrigatória local

```bash
npm ci
npm run lint            # sem erros
npm test                # todas as suítes Vitest passam
npm run test:e2e        # E2E headless passa
npm run test:firestore  # obrigatório: mudanças em repositórios Firebase
npm run test:e2e:emulator  # obrigatório: mudanças em fluxos Firebase no browser
npm run test:cloud      # quando credenciais cloud configuradas localmente
npm run build           # obrigatório: impacto em produção
```

### Casos de validação de comportamento

1. **Fallback funcional:** forçar falha de Pipeline e confirmar resposta via Core sem erro 500.
2. **Busca global `/busca?q=vestido`:** resultados relevantes retornam com ordenação padrão.
3. **Busca em categoria `/categoria/vestidos?q=linho`:** retorna somente da categoria com o termo.
4. **Filtros combinados:** `q + minPrice + maxPrice + sort` produzem resultados corretos.
5. **Paginação:** `page=2` retorna offset correto sem duplicar resultados.
6. **Empty state:** busca sem resultados exibe estado vazio (não erro 500).
7. **Acessibilidade:** campo de busca acessível por teclado, contagem anunciada.
8. **Qualidade vetorial (cloud test):** busca por "vestido de festa" retorna produtos com `score >= 0.7`.

---

## Arquivos a Criar/Modificar

| Arquivo                                            | Ação      | Fase |
| -------------------------------------------------- | --------- | ---- |
| `src/lib/repositories/productMapper.ts`            | Criar     | 2.6  |
| `src/lib/repositories/productsSearchRepository.ts` | Criar     | 2    |
| `src/lib/embeddingService.ts`                      | Criar     | 3    |
| `src/app/busca/page.tsx`                           | Criar     | 4.2  |
| `src/components/busca/SearchInput.tsx`             | Criar     | 4.3  |
| `vitest.cloud.config.mts`                          | Criar     | 6.2  |
| `src/test/cloudTests.globalSetup.ts`               | Criar     | 6.2  |
| `src/test/cloud/sharedSetup.ts`                    | Criar     | 6.2  |
| `src/test/cloud/pipelineSearch.test.ts`            | Criar     | 6.2  |
| `src/test/cloud/vectorSearch.test.ts`              | Criar     | 6.2  |
| `.github/workflows/cloud-firestore-tests.yml`      | Criar     | 6.5  |
| `src/app/categoria/[slug]/page.tsx`                | Modificar | 4.1  |
| `src/components/Header.tsx`                        | Modificar | 4.3  |
| `package.json`                                     | Modificar | 6.2  |
| `firestore.indexes.json`                           | Modificar | 7.1  |
| `src/app/robots.ts`                                | Modificar | 5.3  |
