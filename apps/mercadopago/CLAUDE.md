# @luratha/mercadopago — MercadoPago webhook

Standalone webhook receiver — its **own App Hosting backend** (`luratha-app-mercadopago`,
dev port 3002). No public pages, only `POST /api/webhooks/mercadopago`. The payment logic
it calls (`verifyWebhookSignature`, `applyOrderWebhook`) lives in `@luratha/payments`
(see `packages/payments/CLAUDE.md`).

Webhook contract (`src/app/api/webhooks/mercadopago/post.ts`):

- Public endpoint called by MP servers — secured by `x-signature` HMAC validation
  (`verifyWebhookSignature`), **not** `requireUser`.
- Status codes are a redelivery contract: `401` invalid signature; `500` provider/config
  error (MP **retries**); `200` acknowledged — including non-actionable events and orders
  with no matching local order (MP **stops** retrying).
- The webhook URL is set in the MP panel, not per-request (the Orders API has no
  `notification_url`).
