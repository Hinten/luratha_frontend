# MercadoPago — checklist de teste manual em sandbox

Roteiro para validar **manualmente** o checkout transparente do Luratha contra
a sandbox da MP. Use sempre depois de mudanças no fluxo de pagamento —
`apps/store/src/lib/payment/*` ou `apps/store/src/components/checkout/*` — ou
em qualquer release que toque `POST /api/checkout/payment-intent` ou o webhook
`POST /api/webhooks/mercadopago`.

A suíte automatizada (Vitest + Playwright) **não** chama a MP de verdade — os
adapters são sempre mockados. Esse checklist é a única cobertura real do
provider; rode antes de marcar uma PR de pagamento como pronta.

## Pré-requisitos

- Credenciais de **teste** configuradas no `.env` da raiz
  (`MERCADOPAGO_ACCESS_TOKEN=TEST-...`, `MERCADOPAGO_WEBHOOK_SECRET=...`,
  `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=TEST-...`). Veja `docs/mercadopago-setup.md`.
- Para **PIX e Boleto**: `pnpm dev` em `http://localhost:3000` basta.
- Para **Cartão**: testar via deploy no Firebase App Hosting (URL HTTPS real).
  Veja seção HTTPS abaixo.
- Conta de teste logada na loja (cadastre uma em `/register`).
- Webhook simulável via o **simulador de webhooks** do painel MP
  (não precisa de tunnel pra esse pedaço).

## HTTPS obrigatório pro Cartão

O SDK do MercadoPago injeta um iframe cross-origin que tenta setar o cookie
`x-meli-session-id` (device fingerprinting, parte do antifraude). Em
`http://localhost:3000` os navegadores modernos rejeitam esse cookie
(`SameSite=None` requer `Secure`, que requer HTTPS). Sem ele a tokenização
do cartão funciona, mas a taxa de aprovação cai e em alguns casos a API da
MP rejeita o payment com `cc_rejected_high_risk`.

**Recomendado**: subir o branch num backend do Firebase App Hosting e testar
pela URL HTTPS gerada — o cookie do MP é aceito normalmente porque é
domínio com TLS válido. Mesmo fluxo do CI, com credenciais reais.

```bash
firebase deploy --only apphosting:store
# ou apenas push no branch que dispara o build no App Hosting
```

A URL aparece no console do Firebase (algo como
`https://store--luratha-96386.us-central1.hosted.app`).

**Se você só está testando PIX/Boleto**, pode usar `pnpm dev` em localhost —
esses métodos não dependem do fingerprinting.

**No CI**: o suite mocka todas as chamadas à MP, então não há dependência
de HTTPS. Os testes unit/firestore rodam em `http://localhost` normal.

## Cartões de teste (Brasil — MLB)

| Bandeira | Número | CVV | Validade | Comportamento |
|---|---|---|---|---|
| Mastercard | `5031 7557 3453 0604` | qualquer 3 dígitos | qualquer futura | **APRO** — aprovado |
| Visa | `4235 6477 2802 5682` | qualquer 3 dígitos | qualquer futura | **APRO** — aprovado |
| Mastercard | `5031 4332 1540 6351` | qualquer 3 dígitos | qualquer futura | **OTHE** — recusado (motivo genérico) |
| Mastercard | `5031 4332 1540 6351` *(use nome `CONT`)* | qualquer | qualquer | **CONT** — pendente (pending) |

> Para forçar status específicos, **mude o nome no cartão** (campo
> "Nome impresso") para o status desejado: `APRO`, `OTHE`, `CONT`, `CALL`,
> `FUND`, `SECU`, `EXPI`, `FORM`. Esse é o protocolo oficial da MP para
> simular respostas em sandbox.

Documento: qualquer CPF válido (ex.: `12345678909`).

## Roteiro PIX

1. Adicione um produto ao carrinho e vá a `/checkout`.
2. Selecione endereço → continue.
3. Selecione frete → continue.
4. Step 3 (Pagamento): escolha **PIX**, preencha e-mail + CPF → confirmar.
5. Step 4 (Revisão): confirmar pedido.
6. **Esperado:** `PaymentResult` renderiza o QR Code (imagem base64) + botão
   "Copiar código" funcional.
7. Simule o pagamento: abra o painel MP → sua aplicação → **Pagamentos** → ache
   o pagamento `pending` → marque como **aprovado**.
8. O webhook MP atinge `POST /api/webhooks/mercadopago` (ngrok ou simulador).
9. Recarregue `/conta/pedidos/<id>` — `paymentStatus` deve estar `paid` e
   `Order.status` deve estar `paid` com `paidAt` preenchido.

## Roteiro Cartão — aprovação

1. Steps 1–2 como acima.
2. Step 3: escolha **Cartão**, preencha:
   - e-mail + CPF do pagador
   - nome impresso = `APRO`
   - número `5031 7557 3453 0604`, validade `12/30`, CVV `123`
   - parcelas: 1
3. Confirmar pagamento → step 4 → confirmar pedido.
4. **Esperado:** `router.replace` para `/checkout/sucesso/<orderId>` imediato
   (cartão aprovado é síncrono); `clearCart()` rodou; página de sucesso
   exibe número do pedido + JSON-LD.
5. Verificar no painel MP: pagamento `approved`.

## Roteiro Cartão — recusa + retry

1. Steps 1–2 como acima.
2. Step 3: cartão `5031 4332 1540 6351`, nome `OTHE`.
3. Confirmar → step 4 → confirmar pedido.
4. **Esperado:** `PaymentResult` mostra "Pagamento recusado" + statusDetail +
   botão "Tentar outro método" que volta ao step 3 (sem perder cart).
5. Refaça com nome `APRO` → deve aprovar.

## Roteiro Boleto

1. Steps 1–2 como acima.
2. Step 3: escolha **Boleto**, preencha e-mail + CPF.
3. Confirmar → step 4 → confirmar pedido.
4. **Esperado:** `PaymentResult` mostra link "Abrir boleto em PDF" (URL da MP)
   e linha digitável. Clique no link → o PDF do boleto abre em nova aba.
5. No painel MP, marque como pago manualmente → webhook deve flippar o pedido
   para `paid`.

## Checklist final antes de PR ready

- [ ] PIX QR aparece e código pode ser copiado
- [ ] Cartão APRO redireciona para `/sucesso` e marca como paid
- [ ] Cartão OTHE permite retry sem perder cart
- [ ] Boleto gera URL acessível
- [ ] Webhook `paid` chega e flippa `paymentStatus` no Firestore
- [ ] `/conta/pedidos/<id>` reflete o status final
- [ ] Nenhuma chamada real à MP saiu da suite automatizada
  (`pnpm test` + `pnpm test:firestore` + `pnpm test:e2e` continuam mockando)

## Onde olhar quando algo falhar

| Sintoma | Provavelmente é | Onde checar |
|---|---|---|
| `code: "config_missing"` no payment-intent | `MERCADOPAGO_ACCESS_TOKEN` não foi lido | `.env` + reinício do `pnpm dev` |
| QR PIX em branco | response sem `pix.qrCodeBase64` | log de `apps/store/src/lib/payment/mercadoPago/index.ts` |
| Webhook 401 ou 403 | endpoint público sendo gateado por engano | `apps/store/src/app/api/webhooks/mercadopago/post.ts` (não chama `requireUser`) |
| Webhook 400 | assinatura inválida | `MERCADOPAGO_WEBHOOK_SECRET` diferente do painel |
| Order não muda de status | `external_reference` divergente | log do webhook + `Order.paymentIntentId` |
| `cardForm` não carrega iframes | `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` faltando | console do browser; precisa começar com `TEST-` na sandbox |

## Referências

- Setup de credenciais: `docs/mercadopago-setup.md`
- Skill: `.github/skills/mercadopago-payments/SKILL.md`
- Cartões de teste oficiais MP:
  <https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/test-cards>
- Forçar status via nome no cartão:
  <https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/your-integrations/test/cards>
