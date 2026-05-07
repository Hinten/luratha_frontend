# Plano: Mapa (Roadmap) do E-commerce Luratha — Fluxo de Compra

## Contexto

O Luratha tem fundação sólida (12 coleções Firestore com Zod, autenticação básica, carrinho client-side, browsing completo de produtos/categorias/busca), mas o **fluxo de conversão termina no carrinho**. Não existe checkout, conta logada, nem histórico de pedidos — ou seja, hoje é impossível concluir uma compra. Schemas de `Order`, `UserProfile` e `Coupon` já estão modelados em `src/schemas/firestore/`, mas sem repositório, API ou UI.

Este plano é um **roadmap priorizado** para fechar o fluxo crítico de compra (checkout → conta → pedidos). Páginas institucionais (privacidade, termos, FAQ, frete) e melhorias secundárias (wishlist, reset de senha, sitemap.xml com produtos) ficam como Fase 2 e 3, fora do escopo de execução imediata.

## Estado Atual (snapshot)

**Existe:**
- Rotas: `/`, `/carrinho`, `/busca`, `/login`, `/register`, `/logout`, `/categoria/[slug]`, `/produto/[slug]`, `/todas-as-pecas`, `/sale`, `/sobre`, `/contato`, `/referencia-de-medidas`, `/politica-de-trocas`
- APIs: `products`, `categories`, `stock`, `images`, `dev/seed-mock-data`
- Contexts: `AuthContext` (localStorage), `CartContext` (localStorage)
- Repos: `categoriesRepository`, `productsRepository`, `productsSearchRepository`, `stockRepository`
- Schemas Firestore prontos sem UI: `orders.ts`, `users.ts` (UserProfile), `coupons.ts`, `reviews.ts`, `carts.ts`

**Não existe (gaps):**
- ❌ Páginas: `/checkout`, `/conta`, `/conta/pedidos`, `/conta/pedidos/[id]`, `/conta/enderecos`, `/conta/dados`
- ❌ APIs: `orders`, `users`, `coupons`, `cart` (server-side)
- ❌ Repos: `ordersRepository`, `usersRepository`, `couponsRepository`
- ❌ DataConverters Admin/Client para Order, UserProfile, Coupon
- ❌ Integração de pagamento (Stripe/MercadoPago/PagSeguro)
- ❌ Cálculo de frete (Correios/Melhor Envio)
- ❌ Middleware de proteção para rotas autenticadas (`/conta/*`, `/checkout`)
- ❌ Produtos individuais no `sitemap.ts` (gap de SEO já mapeado)

---

## Roadmap — Fase 1: Fluxo de Compra (crítica)

### 1.1 Infra compartilhada (pré-requisito)

**Arquivos a criar:**
- `src/lib/repositories/ordersRepository.ts` — list/get/create/update (espelhar `productsRepository.ts`)
- `src/lib/repositories/usersRepository.ts` — getProfile/updateProfile/listAddresses/upsertAddress
- `src/lib/repositories/couponsRepository.ts` — getByCode/validateForCart
- `src/lib/firestore/adminOrderConverter.ts` + `clientOrderConverter.ts` (Order tem `Timestamp` em `createdAt`/`paidAt`/`shippedAt`)
- `src/lib/firestore/adminUserProfileConverter.ts` + `clientUserProfileConverter.ts`
- ~~`src/middleware.ts` — proteger `/conta/*` e `/checkout` exigindo auth~~ ✅ entregue em PR #81 (presence-check no edge + `requireUser()` nos handlers)

**Padrões a seguir** (do `CLAUDE.md` + skill `luratha-crud-api`):
- Cada handler HTTP em arquivo próprio + `route.ts` re-exporta
- `export const runtime = "nodejs"` em todas as routes
- Usar `.withConverter()` em todas as refs
- PATCH com merge `{ ...existing, ...payload, ...serverFields }`
- Validar com Zod (`error.issues`, não `.errors`)

### 1.2 APIs (`src/app/api/`)

| Endpoint | Métodos | Notas |
|---|---|---|
| `/api/orders` | GET (list por user), POST (criar a partir do cart) | POST faz: valida estoque, decrementa stock, cria Order com status `pending_payment`, retorna `paymentIntent` |
| `/api/orders/[id]` | GET, PATCH | PATCH para atualizar status (admin) ou cancelar (user dono) |
| `/api/users/[id]` | GET, PATCH | Perfil — só o próprio user ou admin |
| `/api/users/[id]/addresses` | GET, POST, DELETE | CRUD de endereços salvos |
| `/api/coupons/validate` | POST | Recebe `{ code, cartTotal }`, retorna desconto calculado |
| `/api/checkout/shipping` | POST | Stub inicial: aceita CEP+itens, retorna opções (PAC/SEDEX). Plugar Melhor Envio depois |
| `/api/checkout/payment-intent` | POST | Stub: cria intenção de pagamento. Definir provider (ver "Decisões pendentes") |

### 1.3 Páginas (`src/app/`)

**Checkout (1 fluxo, 3-4 steps numa só rota com state):**
- `src/app/checkout/page.tsx` — server component que carrega cart + perfil; client child gerencia steps
  - Step 1: Endereço (form com CEP autocomplete + endereços salvos se logado)
  - Step 2: Frete (chama `/api/checkout/shipping`)
  - Step 3: Pagamento (chama `/api/checkout/payment-intent`)
  - Step 4: Revisão e confirmar → `POST /api/orders`
- `src/app/checkout/sucesso/[orderId]/page.tsx` — confirmação pós-compra
- `src/app/checkout/error.tsx` + `loading.tsx`

**Conta (layout protegido):**
- `src/app/conta/layout.tsx` — sidebar com links (Pedidos, Dados, Endereços, Sair) + checagem auth (redirect `/login?redirect=/conta`)
- `src/app/conta/page.tsx` — dashboard (resumo: último pedido, dados básicos)
- `src/app/conta/dados/page.tsx` — edita perfil (nome, email, telefone) via `PATCH /api/users/[id]`
- `src/app/conta/enderecos/page.tsx` — lista/CRUD de endereços
- `src/app/conta/pedidos/page.tsx` — histórico (lista paginada via `GET /api/orders?userId=me`)
- `src/app/conta/pedidos/[id]/page.tsx` — detalhe do pedido (itens, status, rastreamento, totais)

### 1.4 Componentes

Criar em `src/components/checkout/` e `src/components/conta/`:
- `checkout/StepIndicator.tsx`, `AddressForm.tsx`, `ShippingOptions.tsx`, `PaymentMethodForm.tsx`, `OrderSummary.tsx`
- `conta/AccountSidebar.tsx`, `OrderListItem.tsx`, `OrderStatusBadge.tsx`, `AddressCard.tsx`

**Reutilizar** (já existe):
- `src/contexts/CartContext.tsx` — ler itens no checkout, limpar após sucesso (`clearCart()`)
- `src/contexts/AuthContext.tsx` — checar user logado, redirect login
- `src/components/JsonLd.tsx` — para `Order` schema na página de sucesso
- `src/components/Breadcrumb.tsx` — em todas as subpáginas de `/conta`
- Tokens visuais de `src/app/globals.css` (`var(--color-*)`, `var(--font-*)`) — nunca hex direto (skill `visual-identity`)

### 1.5 SEO/Discoverability

- `src/app/robots.ts` — adicionar `disallow: ["/conta/", "/checkout/"]` (já tem `/conta/`, falta `/checkout/`)
- `src/app/sitemap.ts` — **não incluir** rotas autenticadas, mas aproveitar para corrigir o gap de produtos (adicionar `getCachedProducts()` → URLs `/produto/{slug}`)
- `public/llms.txt` — adicionar nota de que `/conta` e `/checkout` exigem login

### 1.6 Decisões Pendentes (perguntar antes de implementar)

1. **Provider de pagamento**: Stripe BR, MercadoPago, PagSeguro, ou apenas stub? (Brasileira → MercadoPago é o mais comum em slow fashion)
2. **Cálculo de frete**: Melhor Envio (recomendado), Correios direto, ou frete fixo por região?
3. **Cart server-side**: hoje é localStorage. Migrar para Firestore (`/api/cart`) para persistir entre dispositivos? Recomendação: manter localStorage agora, criar Firestore Cart só na conversão para Order.
4. **Rastreamento**: integrar tracking dos Correios na página de detalhe do pedido ou só armazenar `trackingCode` como string?

#### Resolvido (PR #81 — issue #81)

- **AuthContext mock substituído** por Firebase Auth real (createUserWithEmailAndPassword/signInWithEmailAndPassword/signOut/sendPasswordResetEmail).
- **Cookie de sessão `__session`** (HttpOnly, Secure, SameSite=Lax, 14 dias) — nome obrigatório no Firebase App Hosting.
- **Middleware `src/middleware.ts`** faz presence-check do cookie nas rotas `/conta/*` e `/checkout/*`. Verificação autoritativa (assinatura, expiração, claim `admin`) acontece em `requireUser()` dentro dos handlers/server components.
- **Admin role** via custom claim `admin: true` lido do session cookie (`requireOwnerOrAdmin` deixa admin acessar qualquer userId).
- **Reset de senha** entregue junto: página `/esqueci-senha` chamando `sendPasswordResetEmail` do Firebase SDK (sem endpoint server-side).
- **APIs endurecidas**: `/api/orders`, `/api/users/*`, `/api/users/[id]/addresses/*` agora retornam 401 sem cookie e 403 quando uid do token não bate. POST `/api/orders` também valida `body.userId === token.uid`.

---

## Fase 2 (após fase 1) — fora do escopo desta task

- Wishlist (`/favoritos` + schema novo `wishlists` + `/api/wishlist`)
- Reset de senha (`/recuperar-senha`) via `sendPasswordResetEmail` do Firebase Auth
- Submissão de review (UI já tem `ReviewsList`; falta form + `POST /api/reviews`)
- `/conta/cupons` (lista cupons disponíveis)

## Fase 3 — Institucionais (estáticas, baratas)

- `/politica-de-privacidade`, `/termos-de-uso`, `/faq`, `/entrega`
- Atualizar `sitemap.ts`, `robots.ts` e `llms.txt` (skill `luratha-seo`)

---

## Arquivos Críticos a Modificar/Criar

**Novos:**
- `src/middleware.ts`
- `src/lib/repositories/{orders,users,coupons}Repository.ts`
- `src/lib/firestore/{admin,client}{Order,UserProfile}Converter.ts`
- `src/app/api/orders/{route.ts,list.ts,post.ts,[id]/{route.ts,get.ts,patch.ts}}`
- `src/app/api/users/[id]/{route.ts,get.ts,patch.ts,addresses/route.ts}`
- `src/app/api/coupons/validate/route.ts`
- `src/app/api/checkout/{shipping,payment-intent}/route.ts`
- `src/app/checkout/{page.tsx,layout.tsx,error.tsx,loading.tsx,sucesso/[orderId]/page.tsx}`
- `src/app/conta/{layout.tsx,page.tsx,dados/page.tsx,enderecos/page.tsx,pedidos/{page.tsx,[id]/page.tsx}}`
- `src/components/{checkout,conta}/*.tsx` (+`.module.css`)

**Modificar:**
- `src/app/sitemap.ts` — adicionar produtos
- `src/app/robots.ts` — adicionar `/checkout/`
- `src/components/Header.tsx` — link "Minha conta" quando logado
- `src/schemas/firestore/index.ts` — confirmar exports de `Order`/`UserProfile`/`Coupon`
- `vitest.config.mts` — possíveis aliases novos para `server-only` se converters precisarem

---

## Verificação (por fase)

Para cada PR de subfeature da Fase 1, rodar a ordem mandatória do `CLAUDE.md`:

```bash
npx tsc                 # zero erros de tipo
npm run lint            # exit 0
npm test                # unit/component (mockar next/link, next/navigation)
npm run test:firestore  # mandatório — toca schemas e Firestore
npm run test:e2e        # ao menos um spec novo do fluxo (e2e/checkout.spec.ts)
```

**E2E mínimo a criar** (`e2e/checkout.spec.ts`):
1. Login com user de teste
2. Adicionar produto ao carrinho
3. Ir a `/checkout`, preencher endereço, escolher frete, confirmar pagamento (mock)
4. Verificar redirect para `/checkout/sucesso/[orderId]`
5. Ir a `/conta/pedidos` e ver o pedido criado

**Cloud tests** a criar:
- `src/test/cloud/orders.cloud.test.ts` — CRUD de Order via API (com `createCloudTestPrefix()`)
- `src/test/cloud/users.cloud.test.ts` — perfil + endereços
- `src/test/cloud/coupons.cloud.test.ts` — validação

**Smoke manual** (skill `visual-identity`):
- Verificar tipografia/cores dos forms de checkout (Playfair em headings, Inter em body, tokens `var(--color-*)`)
- Estados de focus visível em todos os inputs
- Mobile: stepper colapsável, sidebar de conta vira drawer

---

## Ordem Sugerida de Execução (caso aprove a Fase 1)

1. Converters + repositórios + schemas (sem API, sem UI) — PR 1 ✅
2. APIs `/api/users` e `/api/orders` (sem checkout integration) + cloud tests — PR 2 (em andamento)
3. Páginas `/conta/*` consumindo as APIs — PR 3
4. APIs `/api/coupons/validate` + `/api/checkout/*` — PR 4
5. Páginas `/checkout/*` + e2e — PR 5
6. Middleware de proteção + ajustes de Header/sitemap/robots — PR 6
