---
name: mercadopago-payments
description: Activate this skill whenever the user wants to implement, configure, extend, or debug payment processing in the Luratha frontend — MercadoPago integration, the payment-intent API, the payment webhook, PIX/credit-card/boleto flows, card tokenization, or order payment status. Covers the `src/lib/payment/` architecture introduced for issue #77 (MercadoPago Checkout Transparente), the payment lifecycle, webhook signature validation, the MP-status → Order-status mapping, where credentials live, and the test patterns. Use it so payment changes stay localized and low-risk.
compatibility: Next.js 16 App Router, firebase-admin v13, Zod v4, Vitest 4, TypeScript strict, Node.js 22, mercadopago SDK v2
---

# MercadoPago Payments Guide — Luratha Frontend

## Overview

Luratha processes payments with **MercadoPago Checkout Transparente** — the
payment is created in-site through the `/v1/payments` API, so the customer never
leaves the store. Three methods are supported, all on the same endpoint:

- **PIX** — the API returns a QR code (string + base64 image) the customer scans.
- **Credit card** — the card is tokenized **in the browser** with
  `@mercadopago/sdk-js`; only the resulting `cardToken` reaches the server (PCI
  scope stays minimal). Approval can be synchronous.
- **Boleto** — the API returns a printable boleto URL + barcode.

All payment code lives under `apps/store/src/lib/payment/`:

| File / dir | Purpose |
|---|---|
| `types.ts` | I/O contracts, `PaymentIntentResult`, `PaymentProviderError` |
| `mercadoPago/client.ts` | Reads credentials from env, builds `MercadoPagoConfig` |
| `mercadoPago/index.ts` | Adapter — `createPayment`, `getPayment`, `verifyWebhookSignature`, `mapMpStatus` |
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
                               → MP payment created, external_reference = orderId
                               → Order.paymentIntentId persisted
                               → client receives QR / boleto URL / card status
3. customer pays
4. POST /api/webhooks/mercadopago  (MP server → us)
                               → getPayment(id) → status → Order updated
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
- **The webhook is idempotent.** `applyPaymentWebhook` skips the write when the
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

| MP `status` | `Order.paymentStatus` | `Order.status` side effect |
|---|---|---|
| `approved` | `paid` | → `paid`, sets `paidAt` |
| `authorized` | `authorized` | (stays `pending_payment`) |
| `pending`, `in_process` | `pending` | (stays `pending_payment`) |
| `in_mediation` | `in_dispute` | **untouched** — payment already happened; the order stays where it was (typically `paid`) while MP arbitrates |
| `rejected`, `cancelled` | `failed` | (stays `pending_payment` — customer can retry) |
| `refunded` | `refunded` | → `refunded` (voluntary refund issued by the store) |
| `charged_back` | `charged_back` | → `refunded` (involuntary — bank chargeback after dispute) |

### Why `in_dispute` and `charged_back` are distinct from `refunded`

`in_mediation` only fires **after** the payment has been approved — the buyer
opened a dispute and the money is held while MercadoPago arbitrates. Mapping
it to `pending` (the original behaviour) hid that fact: the customer's account
page would show "aguardando pagamento" even though they had already paid.
`in_dispute` is a paid order that is in active mediation; the storefront keeps
serving it (no rollback) and the backoffice can act on the contestation.

`charged_back` is the bank-issued involuntary reversal that may follow a lost
dispute. It is operationally equivalent to a refund (money out) — the
`Order.status` does go to `refunded` — but the `paymentStatus` keeps the
distinction so the backoffice can tell a planned refund (`refunded`) from a
bank chargeback (`charged_back`).

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
| `MERCADOPAGO_ACCESS_TOKEN` | yes | Server token. `TEST-…` = sandbox, `APP_USR-…` = prod |
| `MERCADOPAGO_WEBHOOK_SECRET` | yes | Validates the `x-signature` header |
| `MERCADOPAGO_WEBHOOK_URL` | no | Public webhook URL; if empty, MP uses the dashboard config |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | yes (UI) | Browser key for card tokenization |

Secrets are read from `process.env` in server-only code (`client.ts`), never
stored in Firestore, never committed. The environment (sandbox vs production)
is determined by the access token prefix — there is no separate flag.

## Extending — common changes

- **A new payment method:** extend the `CreatePaymentInput` union in `types.ts`,
  the discriminated `bodySchema` in `payment-intent/post.ts`, and `buildPaymentBody`
  in `mercadoPago/index.ts`. Add a parsing branch in the result if MP returns
  method-specific data.
- **A second payment provider:** `types.ts` is provider-agnostic enough to host
  a `PaymentProvider` interface + registry, mirroring `src/lib/shipping/`. Until
  then, do not add a registry speculatively — there is one provider.
- **Stock decrement / coupon usage increment on payment:** these belong in
  `applyPaymentWebhook` when the status becomes `paid`. They are intentionally
  out of the current scope (issue #77) — coordinate with the order/coupon owners.

## Test patterns

- **Pure adapter logic** (`src/lib/payment/__tests__/mercadoPago.test.ts`):
  `mapMpStatus` and `verifyWebhookSignature` are pure — test directly, set
  `MERCADOPAGO_WEBHOOK_SECRET` and compute the HMAC in-test.
- **Route handlers** (`__tests__/post.test.ts`): mock `@luratha/auth/requireUser`
  and the `@/src/lib/payment/service` module — assert status codes and branching
  without touching Firestore or MercadoPago.
- **Cloud integration** (`src/test/cloud/paymentApi.cloud.test.ts`): mock the
  whole `@/src/lib/payment/mercadoPago` module (so `createPayment`/`getPayment`/
  `verifyWebhookSignature` never call MP), seed a real Order, run the handlers,
  and assert the **real Firestore** write. Use `describeCloud` +
  `createCloudTestPrefix()`; clean up seeded docs in `afterAll`.
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

## Client-side: tokenização de cartão com `cardForm`

A UI do checkout (`apps/store/src/app/checkout/`) usa o `@mercadopago/sdk-js`
para tokenizar o cartão no browser. Há dois helpers em `apps/store/src/lib/mercadopago/`:

- **`loadSdk.ts`** — carrega o SDK uma única vez (cache + in-flight),
  instancia `new MercadoPago(NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY, { locale: "pt-BR" })`
  e expõe `getMercadoPagoSdk()`. Falha cedo se a public key não estiver no env.
- **`cardForm.ts`** — `mountCardForm({ amount, ids })` envolve `mp.cardForm({
  iframe: true, form: { id, ... }, callbacks })` e devolve um handle com
  `.submit()` que resolve `{ token, paymentMethodId, installments, cardholderEmail }`
  — shape exato do body `credit_card` do `/api/checkout/payment-intent`.
  Erros do SDK chegam via `onError` e viram rejection na Promise (sem try/catch).

**PCI scope**: o `cardForm` monta iframes oficiais da MP só nos campos
sensíveis (PAN, expiry, CVV); o resto do form é nosso HTML controlado por
CSS Modules. A loja nunca toca o PAN/CVV.

**Por que não Bricks**: o Payment Brick devolve um `formData` no shape de
`POST /v1/payments` direto, que não casa com nosso body discriminado por
`paymentMethod` no `/api/checkout/payment-intent`; e o visual do Brick está
preso a 4 temas fixos (`default|dark|bootstrap|flat`). cardForm dá controle
de design + payload correto para nosso backend.

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
- Implementação browser (cardForm): `apps/store/src/lib/mercadopago/`
- UI checkout: `apps/store/src/app/checkout/` e `apps/store/src/components/checkout/`
- Checklist sandbox: `docs/mercadopago-sandbox-checklist.md`
- Roadmap: `plan/checkout-flow-roadmap.md`
- MercadoPago Checkout API: <https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing>
- Related skill: `luratha-crud-api` (API route conventions), `luratha-shipping-provider`
