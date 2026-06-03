# @luratha/payments

Payment domain package — MercadoPago adapter + order orchestration. Imported (server-only)
by the storefront's payment-intent endpoint and by the standalone webhook app
(`apps/mercadopago/`, which has its own CLAUDE.md for the webhook HTTP contract).

Two modules behind the barrel (`src/index.ts`):
- `mercadoPago/*` — provider adapter. Talks to the **Orders API** (`POST/GET /v1/orders`)
  via raw `fetch` (no `mercadopago` npm SDK). Covers PIX, credit card (token from the Card
  Payment Brick) and boleto. Gateway errors become `PaymentProviderError`.
- `orderService.ts` — orchestration. Loads/updates the Firestore `Order` via the Admin SDK
  inside `runTransaction`, so concurrent webhook + payment-intent writes don't clobber each
  other. `applyOrderWebhook` is idempotent (keyed on `external_reference` → local order id;
  no-op when both status and `paymentIntentId` are unchanged).

Consumers (both server-only):
- Storefront: `POST apps/store/src/app/api/checkout/payment-intent` → `createPaymentIntent`
  (the route handler owns authz — order belongs to the user and still awaits payment).
- Webhook: `apps/mercadopago/` → `applyOrderWebhook` (see that app's CLAUDE.md).

`MERCADOPAGO_ENV` must be set explicitly to `sandbox` or `production` — the access-token
prefix does **not** reliably distinguish them (panel TEST tokens can lack the `TEST-`
prefix); a missing/invalid value throws `PaymentProviderError("config_missing")`. Other
env: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_SANDBOX_PAYER_EMAIL`.

Deep flows (Brick, PIX/card/boleto, test cards) → the `mercadopago-payments` skill.
