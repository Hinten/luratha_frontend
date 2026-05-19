# Integração MercadoPago — como obter as credenciais

Este documento explica como gerar as credenciais que a integração de pagamento
do Luratha precisa. O pagamento vive em `apps/store/src/lib/payment/` e o adapter
do MercadoPago (`apps/store/src/lib/payment/mercadoPago/`) usa o **Checkout
Transparente** (API `/v1/payments`): PIX, cartão de crédito e boleto.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | sim | Access token do servidor. `TEST-...` para sandbox, `APP_USR-...` para produção. O ambiente é determinado pelo token — não há flag separada. |
| `MERCADOPAGO_WEBHOOK_SECRET` | sim | Secret de assinatura dos webhooks. Usado para validar o header `x-signature` das notificações. |
| `MERCADOPAGO_WEBHOOK_URL` | não | URL pública do receiver (`.../api/webhooks/mercadopago`). Se vazio, o MP usa a URL configurada no painel. |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | sim (para a UI) | Public key exposta ao browser para tokenizar o cartão com `@mercadopago/sdk-js`. Consumida pela UI de checkout (issue #83). |

> **Importante:** as credenciais são vinculadas ao ambiente. Um par de
> sandbox **não** funciona em produção e vice-versa. Mantenha conjuntos
> distintos.

## 1. Crie a conta e a aplicação

1. Crie/use uma conta em <https://www.mercadopago.com.br>.
2. Acesse o painel de desenvolvedores: <https://www.mercadopago.com.br/developers/panel>.
3. Em **Suas integrações**, clique em **Criar aplicação**.
4. Dê um nome (ex.: `luratha-store`) e selecione o produto **Checkout Transparente**.

## 2. Pegue as credenciais

Dentro da aplicação, abra **Credenciais**. Há dois conjuntos:

- **Credenciais de teste (sandbox):** use durante o desenvolvimento. Pagamentos
  são fictícios, nada é cobrado.
- **Credenciais de produção:** só depois de homologar a integração.

De cada conjunto você precisa de:

- **Access Token** → `MERCADOPAGO_ACCESS_TOKEN`
- **Public Key** → `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`

## 3. Configure o webhook e o secret

1. No painel da aplicação, abra **Webhooks** (ou **Notificações**).
2. Cadastre a URL do receiver: `https://SEU_DOMINIO/api/webhooks/mercadopago`.
3. Marque o evento **Pagamentos**.
4. O painel exibe um **secret de assinatura** — copie para `MERCADOPAGO_WEBHOOK_SECRET`.
   É com ele que o servidor valida o header `x-signature` de cada notificação.

O receiver é idempotente: reenvios do MercadoPago para o mesmo pagamento não
reescrevem o pedido.

## 4. Configure as variáveis

Na raiz do repositório existe **um único `.env`** (não versionado). Copie do
template e preencha o bloco do MercadoPago:

```bash
cp .env.example .env
```

```bash
# Desenvolvimento / testes (credenciais de teste do painel MP)
MERCADOPAGO_ACCESS_TOKEN="TEST-0000000000000000-000000-xxxxxxxx-000000000"
MERCADOPAGO_WEBHOOK_SECRET="<secret-do-painel>"
MERCADOPAGO_WEBHOOK_URL=""
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY="TEST-xxxxxxxx-0000-0000-0000-000000000000"
```

Em produção (Firebase App Hosting), configure as mesmas variáveis como
**secrets/variáveis de ambiente do backend** — nunca commite os valores reais.

## 5. Valide

Com o servidor rodando (`pnpm dev`) e um pedido já criado via `POST /api/orders`
(status `pending_payment`), crie a intenção de pagamento PIX:

```bash
curl -X POST http://localhost:3000/api/checkout/payment-intent \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=<cookie-de-sessao>" \
  -d '{
    "paymentMethod": "pix",
    "orderId": "<id-do-pedido>",
    "payer": {
      "email": "comprador@teste.com",
      "identification": { "type": "CPF", "number": "12345678909" }
    }
  }'
```

Resposta esperada (201): um `PaymentIntentResult` com `pix.qrCode` e
`pix.qrCodeBase64`. Se vier `{ "code": "config_missing" }`, o access token não
foi lido — confira o `.env` e reinicie o `pnpm dev`.

Para confirmar o webhook sem pagar de verdade, use o **simulador de webhooks**
do painel do MercadoPago (na seção Webhooks) — ele envia uma notificação
assinada para a URL cadastrada, e o pedido deve passar a `paymentStatus: paid`.

## Referências

- Documentação oficial — Checkout API: <https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing>
- Validação de webhooks: <https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks>
- SDK Node.js: <https://github.com/mercadopago/sdk-nodejs>
- Plano de checkout: `plan/checkout-flow-roadmap.md`
- Implementação: `apps/store/src/lib/payment/`
