---
name: mercadopago-payments
description: Activate this skill whenever the user wants to implement, configure, extend, or debug payment processing in the Luratha frontend — MercadoPago integration, the payment-intent API, the payment webhook, PIX/credit-card/boleto flows, card tokenization, or order payment status. Covers the `@luratha/payments` package architecture (split between the storefront's payment-intent endpoint and the dedicated `apps/mercadopago` webhook backend), the payment lifecycle, webhook signature validation, the MP-status → Order-status mapping, where credentials live, and the test patterns. Use it so payment changes stay localized and low-risk.
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

All payment code lives in the **`@luratha/payments`** workspace package
(`packages/payments/`), shared between the storefront (creates the payment)
and the dedicated `apps/mercadopago` webhook app (confirms it):

| File / dir                                    | Purpose                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `packages/payments/src/types.ts`              | I/O contracts, `PaymentIntentResult`, `PaymentProviderError`                                                             |
| `packages/payments/src/mercadoPago/client.ts` | Reads credentials from env, builds `MercadoPagoConfig`                                                                   |
| `packages/payments/src/mercadoPago/index.ts`  | Adapter — `createOrder`, `getOrder`, `verifyWebhookSignature`, `mapMpStatus`, `isMercadoPagoSandbox`, `withSandboxEmail` |
| `packages/payments/src/orderService.ts`       | `Order`-aware orchestration: load order, create payment, persist, apply webhook                                          |
| `packages/payments/src/index.ts`              | Barrel re-export — consumers import from `@luratha/payments`                                                             |

Consumers (both import via `@luratha/payments`):

- `apps/store/src/app/api/checkout/payment-intent/` — calls `createPaymentIntent`
- `apps/mercadopago/src/app/api/webhooks/mercadopago/` — calls `applyOrderWebhook` + `verifyWebhookSignature`

API routes:

| Route                               | App                                                                          | Purpose                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `POST /api/checkout/payment-intent` | `@luratha/store` (storefront)                                                | Creates the MP payment for an existing Order; auth-protected |
| `POST /api/webhooks/mercadopago`    | `@luratha/mercadopago` (dedicated webhook backend `luratha-app-mercadopago`) | Receives MP notifications; **public**, secured by signature  |

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

| `code`                 | payment-intent | webhook                          |
| ---------------------- | -------------- | -------------------------------- |
| `config_missing`       | 500            | 500                              |
| `invalid_input`        | 400            | 200 (acknowledge, nothing to do) |
| `provider_unavailable` | 502            | 500 (so MP retries)              |

The webhook returns **500** on transient failures on purpose — that makes
MercadoPago redeliver the notification later.

## MercadoPago status → `Order` mapping (`mapMpStatus`)

The Orders API uses a smaller status vocabulary than the legacy Payments API.
`mapMpStatus(status, statusDetail?, methodType?)` combines the coarse `status`,
the `status_detail` substatus and the method (`bank_transfer`=pix, `ticket`=boleto):

| MP Orders `status` / `status_detail`             | `Order.paymentStatus` | `Order.status` side effect                        |
| ------------------------------------------------ | --------------------- | ------------------------------------------------- |
| `processed` / `accredited`                       | `paid`                | → `paid`, sets `paidAt`                           |
| `processed` / `partially_refunded`               | `partially_refunded`  | (stays `paid`)                                    |
| `action_required` / `waiting_capture`            | `authorized`          | (stays `pending_payment`)                         |
| `action_required` / `waiting_transfer` (pix)     | `awaiting_pix`        | (stays `pending_payment`)                         |
| `action_required` / `waiting_payment` (ticket)   | `awaiting_boleto`     | (stays `pending_payment`)                         |
| `in_process`, `pending`, `created`, `processing` | `pending`             | (stays `pending_payment`)                         |
| `charged_back` / `in_process`                    | `in_dispute`          | (stays — dispute in progress)                     |
| `charged_back` / `settled`,`reimbursed`          | `charged_back`        | → `refunded`                                      |
| `cancelled`                                      | `cancelled`           | → `cancelled` (order ends)                        |
| `rejected`                                       | `rejected`            | (stays `pending_payment` — customer can retry)    |
| `failed`                                         | `failed`              | (stays `pending_payment` — customer can retry)    |
| `refunded`                                       | `refunded`            | → `refunded`                                      |
| _anything unrecognized_                          | `unknown` (fail-safe) | → `unknown` if still dispatchable + `logger.warn` |

> **Source of truth**: the `PaymentStatus` union, `PAYMENT_STATUSES`,
> `PAYMENT_FAILURE_STATUSES`, `TERMINAL_PAYMENT_STATUSES` and
> `DISPATCHABLE_ORDER_STATUSES` all live in `@luratha/schemas` (`orders.ts`).
> `@luratha/payments` re-exports `PaymentStatus`; never redefine the union.
> The `unknown` fail-safe never shows as "paid" — it blocks fulfillment until a
> human reviews the logged status. `cancelled`/`rejected`/`failed` are split so
> the UI can tell the customer _why_ a payment did not go through.

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

| Variable                             | Required     | Notes                                                                                                                                                                |
| ------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MERCADOPAGO_ACCESS_TOKEN`           | yes          | Server token. Sandbox **may** start with `TEST-` (não é garantido pelo painel atual)                                                                                 |
| `MERCADOPAGO_WEBHOOK_SECRET`         | yes          | Validates the `x-signature` header                                                                                                                                   |
| `MERCADOPAGO_ENV`                    | yes          | `sandbox` ou `production`. Flag explícita lida em `isMercadoPagoSandbox`. Fallback: prefixo `TEST-` quando ausente                                                   |
| `MERCADOPAGO_SANDBOX_PAYER_EMAIL`    | sandbox only | Email do test user comprador (formato `test_user_<N>@testuser.com`). Em sandbox o adapter reescreve `payer.email` por esse valor pra evitar `invalid_users_involved` |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | yes (UI)     | Browser key for card tokenization via the Brick                                                                                                                      |

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

- **Pure adapter logic** (`apps/mercadopago/src/__tests__/mercadoPago.test.ts`):
  `mapMpStatus` and `verifyWebhookSignature` are pure — test directly, set
  `MERCADOPAGO_WEBHOOK_SECRET` and compute the HMAC in-test. The unit tests
  live in the webhook app because that is where the adapter is exercised
  end-to-end; they import from `@luratha/payments`.
- **Route handlers** (`__tests__/post.test.ts`): mock the parts of
  `@luratha/payments` the handler uses (`verifyWebhookSignature`,
  `applyOrderWebhook` for the webhook; `createPaymentIntent`, `loadOrder` for
  payment-intent) plus `@luratha/auth/requireUser` — assert status codes and
  branching without touching Firestore or MercadoPago.
- **Cloud integration**:
  - Storefront `apps/store/src/test/cloud/paymentApi.cloud.test.ts` — covers
    `payment-intent` persisting `paymentIntentId` (mocks
    `@luratha/payments/mercadoPago`, real Firestore write).
  - Webhook app `apps/mercadopago/src/test/cloud/webhook.cloud.test.ts` —
    covers `applyOrderWebhook` advancing `paymentStatus` to `paid` +
    idempotency (mocks `@luratha/payments/mercadoPago`, seeds real Order via
    `adminDb`).
  - Both use `describeCloud` + `createCloudTestPrefix()` and clean up seeded
    docs in `afterAll`.
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
- **Nosso server da loja** (`packages/payments/src/mercadoPago/index.ts` via
  `@luratha/payments`, runtime `nodejs`) chama `POST /v1/orders` server-to-server
  com o `token` opaco recebido do client + `MERCADOPAGO_ACCESS_TOKEN`. Sem CORS.
- **Webhook receiver** (`POST /api/webhooks/mercadopago` no app dedicado
  `@luratha/mercadopago`, backend `luratha-app-mercadopago`) é nosso server —
  MP é quem chama. Isolado da storefront pra facilitar inspeção de logs.

Consequência arquitetural: a tokenização **não pode** ser movida pro server
(entraria em PCI scope D). PIX/Boleto continuam funcionando local sem
peculiaridades porque tokenização não acontece no client (só nosso
`/api/checkout/payment-intent` chama o MP).

**Sandbox quirk** (importante): em sandbox, o MP exige que o `payer.email`
termine em `@testuser.com` e que **resolva pro test user comprador** criado
no painel — não basta um email genérico. O adapter sobrescreve o email
transparente via `withSandboxEmail()` (em `mercadoPago/index.ts`), usando
`MERCADOPAGO_SANDBOX_PAYER_EMAIL` quando setado, ou caindo num rewrite de
domínio como fallback. UI sempre mostra o email real do user.

### Brick em localhost: funciona

Versões anteriores deste doc afirmavam que o Brick "não funciona em localhost
por CORS". **Não é verdade** — refutado empiricamente em 2026-05 com logs dos
specs E2E:

- `POST https://api.mercadopago.com/v1/card_tokens?...&referer=http%3A%2F%2Flocalhost%3A3000` → **201**
  com cardToken válido
- O MP **não rejeita** `referer=http://localhost:3000` em nenhuma das chamadas
  do Brick (devices/widgets, payment_methods/search, installments,
  card_tokens)
- A cadeia falhava antes só por dois motivos derivados, ambos arrumáveis:
  1. **Race no spec entre fills**: preencher cardholder name antes do fetch
     `installments?bin=...` settlar resetava o input por causa do re-render
     do Brick. Solução: aguardar a resposta do `installments` antes de
     preencher os demais campos.
  2. **Race no checkout flow**: clicar `Continuar` rapidamente entre steps
     antes da URL transitar (`?step=address` → `?step=shipping` → ...).
     Solução: `await page.waitForURL(/step=.../)` entre cliques.

### Como testamos o checkout (E2E end-to-end real)

Dois specs cobrem o fluxo completo, ambos no workflow
`.github/workflows/e2e-checkout-mp.yml` (gated por `paths:` filter pra
arquivos do checkout/MP):

- **`apps/store/e2e/checkout-card-real.spec.ts`** — Cartão APRO ponta-a-ponta
  sem mocks: login com MP test user (`TEST_USER_EMAIL`/`TEST_USER_PASSWORD`)
  → checkout → address criado via UI → frete real (Melhor Envio) → Order
  real (`POST /api/orders` cria no Firestore) → tab Cartão → Brick tokeniza
  contra `api.mercadopago.com` → `POST /api/checkout/payment-intent` dispara
  adapter MP server (`POST /v1/orders`) → `mapMpStatus("processed") → "paid"`
  síncrono → redirect `/checkout/sucesso/{orderId}`. Asserta Firestore
  `Order.paymentStatus === "paid"` + `paymentIntentId` do MP.

- **`apps/store/e2e/checkout.spec.ts`** — PIX e Boleto ponta-a-ponta sem
  mocks: mesmo fluxo até `POST /api/checkout/payment-intent`, MP devolve
  `status: "action_required"` (mapeado pra `"pending"`) + `qrCode` (PIX)
  ou `boleto.url` (Boleto). Spec **para em pending** com PaymentResult
  mostrando QR Code real ou link do boleto. Asserta Firestore
  `Order.paymentStatus === "pending"` + `paymentIntentId`. O flow
  `webhook → paid` NÃO é exercitado aqui (webhook não chega em localhost
  nem em runner do GitHub).

Reuso do MP test user entre runs evita lixo no Firestore. Cleanup completo
no `beforeEach`/`afterEach` (`clearFixtureCart` + `clearUserAddresses` +
`clearPendingOrdersFor`) garante runs idempotentes.

Para cobrir o caminho `webhook → paid` (PIX/Boleto/cartão em análise) use
`apps/store/src/test/cloud/paymentApi.cloud.test.ts` — Vitest cloud que
mocka `getOrder` do adapter MP pra simular status atualizado, sem precisar
de browser nem de webhook real.

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
- Implementação backend (adapter + service): `packages/payments/` (pacote `@luratha/payments`)
- Webhook receiver isolado: `apps/mercadopago/` (backend `luratha-app-mercadopago`)
- Implementação browser (Card Payment Brick): `apps/store/src/components/checkout/PaymentStep.tsx`
- UI checkout: `apps/store/src/app/checkout/` e `apps/store/src/components/checkout/`
- Checklist sandbox: `docs/mercadopago-sandbox-checklist.md`
- Roadmap: `plan/checkout-flow-roadmap.md`
- MercadoPago Checkout API (Orders): <https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/landing>
- Related skill: `luratha-crud-api` (API route conventions), `luratha-shipping-provider`
