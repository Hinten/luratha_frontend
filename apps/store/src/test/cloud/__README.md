# Cloud Firestore tests

Esta suíte valida busca textual (pipeline) e vetorial diretamente no Firestore Cloud.
Ela é executada manualmente via `npm run test:cloud` e usa guardas de skip quando as credenciais não estão configuradas.

## Credenciais necessárias

Dois segredos de ambiente são necessários para executar os testes cloud:

| Variável                          | Descrição                                                                   |
| --------------------------------- | --------------------------------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Service account JSON (base64) – usado pelo Admin SDK para seed/cleanup      |
| `FIREBASE_WEB_APP_CONFIG_BASE64`  | Web app config JSON (base64) – usado pelo Client SDK no repositório testado |

Sem essas variáveis, todos os testes são pulados automaticamente com `describe.skip`.

## Arquivos

| Arquivo                                  | O que testa                                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pipelineSearch.test.ts`                 | Valida construção dos planos de busca textual (pipeline) e roteamento `shouldUsePipeline`                                                                                                |
| `vectorSearch.test.ts`                   | Valida construção dos planos de busca vetorial (pipeline-vector)                                                                                                                         |
| `productsSearchRepository.cloud.test.ts` | Testes de integração real com Firebase Cloud – semeia dados via Admin SDK, executa as 3 rotas de busca (pipeline, core, vector-fallback) e testa filtros de categoria, preço e paginação |

## Caminhos testados em `productsSearchRepository`

1. **Pipeline search** – busca com termo textual (`shouldUsePipeline → true`)
2. **Core search fallback** – busca sem termo, apenas com filtros (`shouldUsePipeline → false`)
3. **Filtro de categoria** – resolução de `categorySlug` → `categoryId` via `categoriesRepository`
4. **Categoria desconhecida** – retorna `[]` sem executar query
5. **Filtro de preço** – `minPrice` / `maxPrice` nos caminhos pipeline e core
6. **Paginação** – `offset` no caminho core retorna página diferente
7. **Fallback de vetor** – `useVectors=true` com embedding service sem Vertex AI cai para pipeline/core sem lançar erro
8. **Guarda de termo vazio** – a página (`busca/page.tsx`) retorna `[]` sem chamar o repositório
