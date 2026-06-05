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

| Endpoint                       | Métodos                                            | Notas                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/orders`                  | GET (list por user), POST (criar a partir do cart) | POST faz: valida estoque, decrementa stock, cria Order com status `pending_payment`, retorna `paymentIntent`                                                    |
| `/api/orders/[id]`             | GET, PATCH                                         | PATCH para atualizar status (admin) ou cancelar (user dono)                                                                                                     |
| `/api/users/[id]`              | GET, PATCH                                         | Perfil — só o próprio user ou admin                                                                                                                             |
| `/api/users/[id]/addresses`    | GET, POST, DELETE                                  | CRUD de endereços salvos                                                                                                                                        |
| `/api/coupons/validate`        | POST                                               | ✅ entregue (issue #82 final, junto da #83) — autenticado, valida cupom contra `cartTotal` e devolve `{valid, code, type, discount}` ou `{valid:false, reason}` |
| `/api/checkout/shipping`       | POST                                               | Stub inicial: aceita CEP+itens, retorna opções (PAC/SEDEX). Plugar Melhor Envio depois                                                                          |
| `/api/checkout/payment-intent` | POST                                               | ✅ entregue (issue #77) — cria o pagamento no MercadoPago (PIX/cartão/boleto). Webhook em `/api/webhooks/mercadopago`                                           |

### 1.3 Páginas (`src/app/`) ✅ entregue (issue #83)

**Checkout (1 fluxo, 4 steps numa só rota com state):** ✅

- `src/app/checkout/page.tsx` — client component que monta `CheckoutFlow.tsx` (server-side gate via `src/proxy.ts`)
  - Step 1: Endereço — `AddressStep` lista salvos via `/api/users/[uid]/addresses` + inline `AddressForm`
  - Step 2: Frete — `ShippingStep` chama `/api/checkout/shipping`
  - Step 3: Pagamento — `PaymentStep` com tabs PIX/Cartão/Boleto; cardForm da MP é lazy-mounted
  - Step 4: Revisão — `OrderSummary` + `CouponField`; ao confirmar: `POST /api/orders` → `POST /api/checkout/payment-intent` → `PaymentResult` (PIX/boleto) ou redirect (cartão aprovado)
- `src/app/checkout/sucesso/[orderId]/page.tsx` — server component, carrega Order via `adminDb` + JsonLd + `SuccessClient` limpa cart
- `src/app/checkout/{layout.tsx,error.tsx,loading.tsx}` ✅

**Conta (layout protegido):**

- `src/app/conta/layout.tsx` — sidebar com links (Pedidos, Dados, Endereços, Sair) + checagem auth (redirect `/login?redirect=/conta`)
- `src/app/conta/page.tsx` — dashboard (resumo: último pedido, dados básicos)
- `src/app/conta/dados/page.tsx` — edita perfil (nome, email, telefone) via `PATCH /api/users/[id]`
- `src/app/conta/enderecos/page.tsx` — lista/CRUD de endereços
- `src/app/conta/pedidos/page.tsx` — histórico (lista paginada via `GET /api/orders?userId=me`)
- `src/app/conta/pedidos/[id]/page.tsx` — detalhe do pedido (itens, status, rastreamento, totais)

### 1.4 Componentes

Criar em `src/components/checkout/` e `src/components/conta/`:

- ✅ `checkout/`: `StepIndicator.tsx`, `AddressForm.tsx` (extraído de `/conta/enderecos`), `AddressStep.tsx`, `ShippingStep.tsx`, `PaymentStep.tsx`, `PaymentResult.tsx`, `OrderSummary.tsx`, `CouponField.tsx` — todos com `.module.css` e testes unitários
- ✅ `conta/`: `AccountSidebar.tsx`, `OrderListItem.tsx`, `OrderStatusBadge.tsx`, `AddressCard.tsx` (já entregues em PRs anteriores)

Helpers do MercadoPago (browser): `src/lib/mercadopago/{loadSdk,cardForm}.ts` — wrapper lazy do `@mercadopago/sdk-js` que devolve `{token, paymentMethodId, installments, cardholderEmail}` no shape esperado pelo `payment-intent`. ✅

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

1. ~~**Provider de pagamento**: Stripe BR, MercadoPago, PagSeguro, ou apenas stub?~~ ✅ resolvido — issue #77. **MercadoPago** via **Checkout Transparente** (API `/v1/payments`), suportando PIX, cartão de crédito e boleto. Integração em `apps/store/src/lib/payment/`.
2. ~~**Cálculo de frete**: Melhor Envio (recomendado), Correios direto, ou frete fixo por região?~~ ✅ resolvido — issue #78. **Melhor Envio** como provider padrão atrás da interface `ShippingProvider` (`src/lib/shipping/`), com `fixed-rate` como fallback automático e plugável via `siteSettings.shipping.providerId`.
3. **Cart server-side**: hoje é localStorage. Migrar para Firestore (`/api/cart`) para persistir entre dispositivos? Recomendação: manter localStorage agora, criar Firestore Cart só na conversão para Order.
4. **Rastreamento**: ✅ resolvido (parcial — issue #80 Opção A entregue junto). Schema `Order` agora aceita `trackingCode`/`trackingUrl`/`shippedAt`/`deliveredAt` (manual MVP). A interface `ShippingProvider` já define `track()` — Melhor Envio devolve `not_supported` até PR 2 (issue #80 Opção B: polling ativo + timeline).

#### Resolvido (PR Pagamento — issue #77)

- **Provider** em `apps/store/src/lib/payment/`: `types.ts` (contratos + `PaymentProviderError`), adapter `mercadoPago/` (`createPayment`, `getPayment`, `verifyWebhookSignature`, `mapMpStatus`) e `service.ts` (orquestração com a `Order` via Admin SDK).
- **MercadoPago Checkout Transparente** (API `/v1/payments`, SDK `mercadopago` v2) cobrindo **PIX** (QR code), **cartão de crédito** (token gerado no browser) e **boleto**.
- **API** `POST /api/checkout/payment-intent`: autenticada, recebe `orderId` + dados do método, cria o pagamento no MP (`external_reference = orderId`, idempotency key = `orderId`) e devolve `PaymentIntentResult` (QR PIX / URL do boleto / status do cartão).
- **Webhook** `POST /api/webhooks/mercadopago`: público, validado por assinatura `x-signature` (HMAC-SHA256). Consulta o pagamento, mapeia o status MP→`Order` e atualiza `paymentStatus`/`status`/`paidAt`. Idempotente — reenvios não reescrevem.
- **Order schema** estendido com `paymentIntentId` e `paidAt` (ambos opcionais, retro-compat).
- **Env vars**: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_ENV` (sandbox/production), `MERCADOPAGO_SANDBOX_PAYER_EMAIL` (sandbox only), `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`. Template em `.env.example`; passo-a-passo em `docs/mercadopago-setup.md`. Skill: `.github/skills/mercadopago-payments/`.
- **Fora de escopo desta entrega**: UI do Step 3 / tokenização de cartão no browser (issue #83), decremento de estoque e incremento de uso de cupom no `paid`.

#### Resolvido (PR Frete — issue #78 + parte de #80)

- **Provider plugável** em `src/lib/shipping/`: interface `ShippingProvider` (`calculate` + `track` opcional), adapter `melhorEnvio/`, fallback `fixed-rate/` por tabela de UF (resolvida do prefixo do CEP) e factory `getShippingProvider()`.
- **Configuração centralizada** em `settings/global` (`siteSettingsSchema`): `providerId`, `originPostalCode`, `enabledServices[]`, `fallbackProductWeightKg`, `cacheTtlSeconds`, `freeShipping.{divisor, minThreshold, maxThreshold, enabled}`, `fixedRate.{entries, defaultEntry, enabledAsFallback}`. Repositório lê com cache em memória de 60s + `forceFresh`.
- **Frete grátis baseado em CEP**: `quoteFreeShippingThreshold(cep)` simula 1kg pelo provider, aplica `threshold = shippingCost1kg / divisor` (default 0,14) com clamp por min/max. Loja absorve a diferença no checkout quando aplicável (`OrderShippingMethod.freeShippingApplied`).
- **API** `POST /api/checkout/shipping` em dois modos: `mode: "quote"` (carrinho completo) e `mode: "free-shipping-only"` (PDP/cart).
- **UI**: `ShippingEstimator` na PDP (CEP → frete grátis em tempo real, persistido em `localStorage["luratha_shipping_estimate"]`), barra de progresso "Faltam R$X para frete grátis" no carrinho.
- **Order schema** estendido com `shippingMethod` snapshot, `trackingCode`, `trackingUrl`, `shippedAt`, `deliveredAt` (todos opcionais — retro-compat).
- **Env vars necessárias** (prod/sandbox): `MELHOR_ENVIO_TOKEN`, `MELHOR_ENVIO_ENV` (`sandbox`|`production`), `MELHOR_ENVIO_USER_AGENT` (opcional). Template em `.env.example`; passo-a-passo para obter o token em `docs/melhor-envio-setup.md`.
- **Cache**: in-memory por (CEP + assinatura do carrinho), TTL configurável. **Fallback `fixed-rate` é OFF por padrão** (`siteSettings.shipping.fixedRate.enabledAsFallback`, default `false`) — a falha do provider primário retorna 502 e bloqueia o checkout, evitando vender frete por tabela fixa que pode dar prejuízo. Ligando o flag, o `callProvider` cai para `fixed-rate` e ainda trata a indisponibilidade do próprio fallback (erro combinado citando primário + fallback).
- **Snapshot de frete no item de carrinho**: `cartItemSchema.dimensions` guarda peso/medidas copiados do produto (server-side, anti-spoof) no add-to-cart e no merge; deixa o carrinho/checkout calcular frete real pelo modo `quote`.
- **`free-shipping-only`** retorna também as `quotes` de 1kg ("frete a partir de"), exibidas na PDP pelo `ShippingEstimator`.

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
