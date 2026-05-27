---
name: mercadopago-payments
description: Activate this skill whenever the user wants to implement, configure, extend, or debug payment processing in the Luratha frontend — MercadoPago integration, the payment-intent API, the payment webhook, PIX/credit-card/boleto flows, card tokenization, or order payment status. Covers the `src/lib/payment/` architecture introduced for issue #77 (MercadoPago Checkout Transparente), the payment lifecycle, webhook signature validation, the MP-status → Order-status mapping, where credentials live, and the test patterns. Use it so payment changes stay localized and low-risk.
compatibility: Next.js 16 App Router, firebase-admin v13, Zod v4, Vitest 4, TypeScript strict, Node.js 22, mercadopago SDK v2
---

# MercadoPago Payments Guide — Luratha Frontend

## Overview

Luratha processes payments with **MercadoPago Checkout Transparente** via the
new **Orders API** (`POST /v1/orders`) — the payment is created in-site, the
customer never leaves the store. Three methods supported:

- **PIX** — the API returns a QR code (string + base64 image) the customer scans.
- **Credit card** — the card is tokenized **in the browser** by the
  **Card Payment Brick** from `@mercadopago/sdk-react`; only the resulting
  `cardToken` reaches the server (PCI scope stays minimal). Approval can be
  synchronous.
- **Boleto** — the API returns a printable boleto URL + barcode.

All payment code lives under `apps/store/src/lib/payment/`:

| File / dir | Purpose |
|---|---|
| `types.ts` | I/O contracts, `PaymentIntentResult`, `PaymentProviderError` |
| `mercadoPago/client.ts` | Reads credentials from env, builds `MercadoPagoConfig` |
| `mercadoPago/index.ts` | Adapter — `createOrder`, `getOrder`, `verifyWebhookSignature`, `mapMpStatus`, `isMercadoPagoSandbox`, `withSandboxEmail` |
| `service.ts` | `Order`-aware orchestration: load order, create payment, persist, apply webhook |

API routes:

| Route | Purpose |
|---|---|
| `POST /api/checkout/payment-intent` | Creates the MP payment for an existing Order; auth-protected |
| `POST /api/webhooks/mercadopago` | Receives MP notifications; **public**, secured by signature |

## Payment lifecycle

```
1. POST /api/orders            → Order created, status "pending_payment", paymentStatus "pending"
2. POST /api/checkout/payment-intent (orderId, paymentMethod, payer, …)
                               → MP order created via createOrder(), external_reference = orderId
                               → Order.paymentIntentId persisted
                               → client receives QR / boleto URL / card status
3. customer pays
4. POST /api/webhooks/mercadopago  (MP server → us)
                               → getOrder(id) → status → Order updated
                               → on approval: paymentStatus "paid", status "paid", paidAt set
```

The Order is **always created before** the payment so `external_reference` can
point at it — that is how the asynchronous webhook finds the right order.

## Key design rules

- **`external_reference` = `Order.id`.** Never omit it; the webhook depends on it.
- **Idempotency key = `Order.id`.** Passed as `requestOptions.idempotencyKey` on
  `payment.create` so a retried payment-intent never double-charges.
- **The webhook is public and unauthenticated.** It must NOT call `requireUser()`.
  Its only gate is `verifyWebhookSignature` — an HMAC-SHA256 check on `x-signature`.
- **The webhook is idempotent.** `applyOrderWebhook` skips the write when the
  Order is already in the target `paymentStatus`. MP retries notifications.
- **Order updates from server paths use the Admin SDK** (`adminDb` +
  `adminOrderConverter`), not the client `ordersRepository`. See `service.ts`.
- **Errors are typed.** Every failure is a `PaymentProviderError` with a `code`
  (`config_missing` | `invalid_input` | `provider_unavailable` | `unknown`).
  Route handlers map the code to an HTTP status — never swallow it.

## The `PaymentProviderError` → HTTP status mapping

| `code` | payment-intent | webhook |
|---|---|---|
| `config_missing` | 500 | 500 |
| `invalid_input` | 400 | 200 (acknowledge, nothing to do) |
| `provider_unavailable` | 502 | 500 (so MP retries) |

The webhook returns **500** on transient failures on purpose — that makes
MercadoPago redeliver the notification later.

## MercadoPago status → `Order` mapping (`mapMpStatus`)

The Orders API uses a smaller status vocabulary than the legacy Payments API.
`mapMpStatus` normalizes everything to one of four terminal values:

| MP Orders `status` | `Order.paymentStatus` | `Order.status` side effect |
|---|---|---|
| `processed` | `paid` | → `paid`, sets `paidAt` |
| `action_required` | `pending` | (stays `pending_payment` — PIX/boleto aguardando compensação) |
| `in_process`, `pending`, `created` | `pending` | (stays `pending_payment`) |
| `cancelled`, `failed`, `rejected` | `failed` | (stays `pending_payment` — customer can retry) |
| `refunded` | `refunded` | → `refunded` |
| _anything else_ | `pending` | default fall-through |

> **Note**: dispute/chargeback semantics (`in_dispute`, `charged_back`,
> `authorized`) that existed in the old Payments API are not surfaced by the
> Orders API. If MP later exposes them, add a case in `mapMpStatus` and a
> new member to `PaymentStatus` in `types.ts`.

## Webhook signature validation

MercadoPago signs every notification. `verifyWebhookSignature` rebuilds the
manifest and HMACs it:

```
manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
expected = HMAC_SHA256_hex(MERCADOPAGO_WEBHOOK_SECRET, manifest)
```

- `ts` and `v1` are parsed from the `x-signature` header (`ts=...,v1=...`).
- `data.id` comes from the `?data.id=` query param (fallback: body `data.id`).
- Alphanumeric ids are lowercased before hashing.
- The comparison is constant-time (`crypto.timingSafeEqual`).

## Credentials (env vars)

See `docs/mercadopago-setup.md` for the full how-to.

| Variable | Required | Notes |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | yes | Server token. Sandbox **may** start with `TEST-` (não é garantido pelo painel atual) |
| `MERCADOPAGO_WEBHOOK_SECRET` | yes | Validates the `x-signature` header |
| `MERCADOPAGO_ENV` | yes | `sandbox` ou `production`. Flag explícita lida em `isMercadoPagoSandbox`. Fallback: prefixo `TEST-` quando ausente |
| `MERCADOPAGO_SANDBOX_PAYER_EMAIL` | sandbox only | Email do test user comprador (formato `test_user_<N>@testuser.com`). Em sandbox o adapter reescreve `payer.email` por esse valor pra evitar `invalid_users_involved` |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | yes (UI) | Browser key for card tokenization via the Brick |

A URL do webhook é configurada **no painel MP** (Suas integrações → Webhooks),
não por env var — a Orders API não aceita `notification_url` por requisição.

Secrets are read from `process.env` in server-only code (`client.ts`), never
stored in Firestore, never committed. **Sandbox detection** consulta
`MERCADOPAGO_ENV` primeiro (caminho confiável); cai pro prefixo `TEST-` do
token como fallback (retrocompat). O painel MP nem sempre gera credenciais
TEST com prefixo `TEST-`, então setar `MERCADOPAGO_ENV` explicitamente é
mandatório no apphosting.yaml.

## Extending — common changes

- **A new payment method:** extend the `CreatePaymentInput` union in `types.ts`,
  the discriminated `bodySchema` in `payment-intent/post.ts`, and `buildPaymentBody`
  in `mercadoPago/index.ts`. Add a parsing branch in the result if MP returns
  method-specific data.
- **A second payment provider:** `types.ts` is provider-agnostic enough to host
  a `PaymentProvider` interface + registry, mirroring `src/lib/shipping/`. Until
  then, do not add a registry speculatively — there is one provider.
- **Stock decrement / coupon usage increment on payment:** these belong in
  `applyOrderWebhook` when the status becomes `paid`. They are intentionally
  out of the current scope (issue #77) — coordinate with the order/coupon owners.

## Test patterns

- **Pure adapter logic** (`src/lib/payment/__tests__/mercadoPago.test.ts`):
  `mapMpStatus` and `verifyWebhookSignature` are pure — test directly, set
  `MERCADOPAGO_WEBHOOK_SECRET` and compute the HMAC in-test.
- **Route handlers** (`__tests__/post.test.ts`): mock `@luratha/auth/requireUser`
  and the `@/src/lib/payment/service` module — assert status codes and branching
  without touching Firestore or MercadoPago.
- **Cloud integration** (`src/test/cloud/paymentApi.cloud.test.ts`): mock the
  whole `@/src/lib/payment/mercadoPago` module (so `createOrder`/`getOrder`/
  `verifyWebhookSignature` never call MP), seed a real Order, run the handlers,
  and assert the **real Firestore** write. Use `describeCloud` +
  `createCloudTestPrefix()`; clean up seeded docs in `afterAll`.
- **E2E checkout** (`apps/store/e2e/checkout.spec.ts` PIX + Boleto;
  `apps/store/e2e/checkout-card.spec.ts` cartão): rodam contra `pnpm dev` no
  CI (`e2e-cloud` job). Cada teste **registra um user novo** via `/register`
  UI (`registerNewUser()` em `e2e/_authHelpers.ts`) — só o cookie `__session`
  não basta porque `CheckoutPage` é client component e checa
  `useAuth().user` do Firebase client SDK (estado vive em IndexedDB), e
  reusar um fixture user gerou race entre o snapshot inicial do `CartContext`
  (que pode trazer cart pre-seeded) e o `seedFixtureCart` do teste. Depois do
  register, o spec usa `seedFixtureCart(uid)` em `e2e/_cartHelpers.ts` pra
  escrever o cart Firestore (via Admin SDK) — sem isso o `CheckoutFlow` guard
  redireciona pra `/carrinho`. `/api/orders` e `/api/checkout/payment-intent`
  são interceptados via `page.route` — não batem em Firestore real nem na API
  do MP. O cartão usa o **mock do Brick** (ver seção abaixo). Trade-off:
  ~3-4 users de lixo no projeto `luratha-96386` por PR run — Firebase aguenta
  e dá pra limpar periodicamente.
- Never make real MercadoPago API calls from the test suite.

## Pitfalls

- Forgetting `export const runtime = "nodejs"` on a payment route — `firebase-admin`
  and `node:crypto` do not run on the Edge runtime.
- Calling `requireUser()` in the webhook — it would 401 every MP notification.
- Building the webhook manifest with the wrong `data.id` source — use the query
  param first; MP signs against that.
- Re-reading `Order` with the client converter in a server path — use
  `adminOrderConverter`.
- Treating a `rejected` payment as terminal — keep `Order.status` at
  `pending_payment` so the customer can try another method.

## Client-side: tokenização de cartão com Card Payment Brick

A UI do checkout (`apps/store/src/components/checkout/PaymentStep.tsx`) usa
o **Card Payment Brick** do `@mercadopago/sdk-react` pra tokenizar o cartão
no browser. `initMercadoPago(NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY, { locale })`
roda uma vez no module load; o componente `<CardPayment>` mounta o Brick
quando o tab "Cartão" é selecionado.

O Brick recebe `initialization.payer` pré-preenchido (email + nome + CPF
vindos do step "Seus dados") e chama nosso `onSubmit(formData)` quando o
usuário envia. `formData` traz `{ token, payment_method_id, installments }`
— os dados do payer vêm do **estado central do checkout**, não do iframe MP.

**PCI scope**: o Brick monta iframes em `mercadopago.com` para PAN, expiry e
CVV; o nosso JS nunca toca dados sensíveis do cartão.

**Onde cada chamada MP roda** (auditoria):

- **Iframe MP (client, fora do nosso controle)** chama `POST /v1/card_tokens`
  e `GET /v1/payment_methods/search` direto pra `api.mercadopago.com` —
  PAN+CVV nunca passam pelo nosso JS. Esse é o ponto do PCI scope.
- **Nosso server** (`apps/store/src/lib/payment/mercadoPago/index.ts`, runtime
  `nodejs`) chama `POST /v1/orders` server-to-server com o `token` opaco
  recebido do client + `MERCADOPAGO_ACCESS_TOKEN`. Sem CORS.
- **Webhook receiver** (`/api/webhooks/mercadopago`) é nosso server — MP é
  quem chama.

Consequência: a tokenização **não pode** ser movida pro server (entraria em
PCI scope D). Por isso o Brick não funciona em `localhost` (HTTP ou HTTPS):
o servidor MP rejeita CORS pra domínios locais. Pra testar Cartão de verdade,
**deploy no App Hosting é obrigatório**. PIX/Boleto continuam funcionando
local porque tokenização não acontece no client (só nosso
`/api/checkout/payment-intent` chama o MP).

**Sandbox quirk** (importante): em sandbox, o MP exige que o `payer.email`
termine em `@testuser.com` e que **resolva pro test user comprador** criado
no painel — não basta um email genérico. O adapter sobrescreve o email
transparente via `withSandboxEmail()` (em `mercadoPago/index.ts`), usando
`MERCADOPAGO_SANDBOX_PAYER_EMAIL` quando setado, ou caindo num rewrite de
domínio como fallback. UI sempre mostra o email real do user.

### Por que `next dev --experimental-https` não resolve

Existe o script `pnpm --filter @luratha/store dev:https` (Next.js 16 boota
em `https://localhost:3000` com cert auto-assinado via mkcert), mas **isso
não desbloqueia o Brick** — a rejeição é por CORS no servidor do MP contra
qualquer domínio local, independente do protocolo. HTTPS local serve só
pra debugar cookies `secure: true` ou outros recursos que exigem origem
segura. Para validar empiricamente: rode `pnpm --filter @luratha/store
dev:https` com `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` setada, abra
`https://localhost:3000/checkout`, vá pro tab Cartão, preencha um cartão
APRO e inspecione `POST https://api.mercadopago.com/v1/card_tokens` no
Network — deve falhar com CORS. Se um dia parar de falhar, atualize esta
seção e remova o branch de mock.

### Como testamos o cartão em CI (mock do Brick)

`PaymentStep.tsx` tem um branch gated por `NEXT_PUBLIC_E2E_MOCK_MP_BRICK=1`
que substitui o `<CardPayment>` pelo `E2EMockCardBrick` — um form simples
com `data-testid="mp-brick-mock"` que devolve `{ token: "e2e-mock-card-token",
payment_method_id, installments }`. Em prod a flag está ausente e o branch
some do bundle (inlining de `NEXT_PUBLIC_*` em build time).

`apps/store/e2e/checkout-card.spec.ts` exercita: tab Cartão → form mockado
→ submit → assert `POST /api/checkout/payment-intent` recebeu o body
correto (`cardToken`, `installments`, `paymentMethodId`) → `PaymentResult`
mostra "Pagamento aprovado" via `page.route`. A tokenização real do MP
**não é exercitada** — quando precisar, criar um cloud test server-side
que chame `POST /v1/card_tokens` direto via `fetch` (sem browser, sem CORS)
usando um cartão APRO + `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` sandbox.

## Sandbox / teste manual

Após qualquer mudança no fluxo, rode o checklist manual em
`docs/mercadopago-sandbox-checklist.md`. **Cartões de teste são por país
(siteId)**: a conta MP do projeto é Brasil (MLB), então use Mastercard
`5031 4332 1540 6351` ou Visa `4235 6477 2802 5682` (CVV `123`, val `11/30`).
Cartões de outros países (ex.: `5031 7557 3453 0604` é Argentina/Uruguai/Peru)
quebram com `No payment methods found` — o BIN não existe na conta brasileira.
Status é forçado pelo **nome impresso** no cartão (`APRO`, `OTHE`, `CONT`,
`FUND`, `CALL`, `SECU`, `EXPI`, `FORM`, ...), não pelo número. CPF padrão
pra APRO/OTHE: `12345678909`. A suíte automatizada nunca chama a MP real.

## References

- Setup / credentials: `docs/mercadopago-setup.md`
- Implementação backend: `apps/store/src/lib/payment/`
- Implementação browser (Card Payment Brick): `apps/store/src/components/checkout/PaymentStep.tsx`
- UI checkout: `apps/store/src/app/checkout/` e `apps/store/src/components/checkout/`
- Checklist sandbox: `docs/mercadopago-sandbox-checklist.md`
- Roadmap: `plan/checkout-flow-roadmap.md`
- MercadoPago Checkout API (Orders): <https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/landing>
- Related skill: `luratha-crud-api` (API route conventions), `luratha-shipping-provider`
