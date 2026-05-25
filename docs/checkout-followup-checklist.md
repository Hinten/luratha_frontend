# Checkout — Followup Checklist

Tracker vivo do que ficou pendente após o merge do PR #122 (`feat(checkout): páginas /checkout (4 steps) + cardForm MP`). Não é PR de implementação — é checklist. Conforme cada item for resolvido, vira commit nesse mesmo PR (ou um PR filho) e o item é marcado.

> **Contexto**: o PR #122 entregou todo o fluxo de checkout (4 steps), AddressForm com RHF/Zod, cardForm MP com mount lazy, ReviewSummary, cart sync idempotente, spinner feedback nos botões. Falta: validar tudo no ambiente real (Firebase HTTPS) e cobrir mobile + os gaps de Phase 2/3 do roadmap original.

---

## 1. Sandbox live (Firebase App Hosting HTTPS)

Cobertura real da API MercadoPago — até agora só houve mocks. Subir o branch num backend do App Hosting (URL HTTPS) e exercitar cada cenário. `pnpm dev` local serve só pra PIX/Boleto; Cartão precisa de HTTPS por causa do cookie `x-meli-session-id`.

> **⚠️ Cartões de teste são por país (siteId)**. A conta MP do projeto é **Brasil (MLB)**, então use:
> - **Mastercard**: `5031 4332 1540 6351` — CVV `123`, validade `11/30`
> - **Visa**: `4235 6477 2802 5682` — CVV `123`, validade `11/30`
> - **Amex**: `3753 651535 56885` — CVV `1234`, validade `11/30`
> - **Elo (débito)**: `5067 7667 8388 8311` — CVV `123`, validade `11/30`
>
> O **número** define o país + bandeira; o **nome impresso** controla o cenário de status (`APRO` aprovado, `OTHE` recusado, `CONT` pendente, `FUND` saldo insuficiente, etc — ver tabela completa na [doc oficial MP](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/additional-content/your-integrations/test/cards)). Usar cartão de outro país (ex.: `5031 7557 3453 0604` da Argentina) gera `MercadoPago.js - No payment methods found` no `onBinChange`, que o browser reporta como CORS error porque a resposta da API vem sem `Access-Control-Allow-Origin`.
>
> **CPF no input**: digitar como dígitos puros (`12345678909`) — sem máscara `.`/`-`. O SDK MP lê `.value` do DOM diretamente; tentativas de manter máscara visual + strip programático no submit não funcionam (SDK usa value tracking via event listener, ignora `nativeSetter`/`dispatchEvent` sintético).

- [ ] **PIX**: criar pagamento → QR Code renderiza (base64), botão "Copiar código" copia → marcar pago manualmente no painel MP → webhook hit em `POST /api/webhooks/mercadopago` → `Order.paymentStatus` flippa pra `paid` + `paidAt` preenchido → `/conta/pedidos/{orderId}` mostra status final.
- [ ] **Cartão APRO** (Mastercard `5031 4332 1540 6351` ou Visa `4235 6477 2802 5682`, nome impresso `APRO`, CPF `12345678909`, CVV `123`, validade `11/30`): tokeniza com cardForm SDK, redireciona pra `/checkout/sucesso/{orderId}` direto (aprovação síncrona), `clearCart()` rodou, página de sucesso renderiza com número do pedido + JSON-LD.
- [ ] **Cartão OTHE** (mesmo número, nome `OTHE`, CPF `12345678909`): `PaymentResult` mostra "Pagamento recusado" + statusDetail; botão "Tentar outro método" volta pro Step 3 sem perder o cart.
- [ ] **Cartão CONT** (mesmo número, nome `CONT`): cai em `pending`; `PaymentResult` reflete; webhook deve flippar conforme MP atualiza.
- [ ] **Boleto**: gera URL PDF acessível + linha digitável; marcar pago manualmente no painel MP → webhook flippa pra `paid`.
- [ ] **Webhook assinatura**: confirmar `MERCADOPAGO_WEBHOOK_SECRET` setado no env do App Hosting; envio sem assinatura válida deve retornar 401/400 (não silenciar).
- [ ] **Cupom no Step 4 com Cartão no Step 3**: aplicar cupom em Revisão depois de já ter aberto o tab Cartão. Confirmar que a tokenização ainda funciona, mesmo com o display de parcelas potencialmente desatualizado (ver Limitações).

---

## 2. Mobile audit (nada testado em viewport mobile)

Cada item: DevTools → iPhone SE (375×667) e Pixel 7 (412×915). Marcar OK ou anotar quebra com print.

- [ ] **PDP** (`/produto/[slug]`): galeria de imagens, thumbnails, descrição, seletor de variante (se houver), `AddToCartButton` com spinner.
- [ ] **`/carrinho`**: lista de items (thumb + body + footer responsivos), stepper `+/-` tocável (touch target ≥ 44px), botão Remover, `OrderSummary` empilha embaixo (não lado-a-lado), `ShippingCepForm`, `CartShippingOptions`, "Finalizar Compra" + "Limpar carrinho" (full-width).
- [ ] **`/checkout` Step 1 (Endereço)**: form responsivo, "Apelido" escondido (já é o caso via `hideLabel`), dropdown UF compacto, CEP com máscara, erros inline embaixo dos campos. Botão Continuar acessível sem cobrir conteúdo (sticky?).
- [ ] **`/checkout` Step 2 (Frete)**: lista de opções de frete, opção "Frete grátis" no topo (quando elegível). Cards não cortam texto.
- [ ] **`/checkout` Step 3 (Pagamento)**: tabs PIX/Cartão/Boleto navegáveis com toque, iframes do MP no Cartão dimensionam (`min-height` dos `.iframeMount`), CPF com máscara. Bloco do cartão não estoura largura.
- [ ] **`/checkout` Step 4 (Revisão)**: 3 cards `ReviewSummary` em coluna; botão "Confirmar pedido" no `OrderSummary` aparece **depois** do total. Em mobile o aside vira full-width (já tem media query) — confirmar que o botão fica visível sem scroll.
- [ ] **`/conta` layout**: `AccountSidebar` precisa virar drawer/menu colapsável em mobile? Roadmap original menciona; nunca verificado.
- [ ] **`PaymentResult`** (após PIX/Boleto): QR/URL legíveis, botão "Copiar código" tocável, "Acompanhar pedido" tocável.
- [ ] **Header/Footer**: drawer do menu, badge do carrinho, link "Minha conta" quando logado.

---

## 3. Gaps do roadmap (Phase 2 + 3)

De `plan/checkout-flow-roadmap.md`. Cada item pode virar um PR próprio; este tracker só registra.

- [ ] **Wishlist**: nova rota `/favoritos` + schema `wishlists` + `/api/wishlist`. Verificar se o coração do `ProductCard` já existe (mock) e plugar.
- [ ] **Submit review form**: `ReviewsList` já renderiza; falta o form + `POST /api/reviews` + validação Zod no schema `reviews`.
- [ ] **`/conta/cupons`**: lista cupons disponíveis pro user (segmentação por user ou globais).
- [ ] **Páginas institucionais estáticas**: `/politica-de-privacidade`, `/termos-de-uso`, `/faq`, `/entrega`. Precisa de copy (legal review pra privacidade/termos).
- [ ] **Sitemap com produtos**: `apps/store/src/app/sitemap.ts` hoje só lista rotas estáticas. Adicionar `getCachedProducts()` → `/produto/{slug}` (cap em N).
- [ ] **`robots.ts`**: já tem `/conta/`; confirmar que tem `/checkout/`.
- [ ] **`public/llms.txt`**: adicionar nota de que `/conta/*` e `/checkout/*` exigem login.

---

## 4. Limitações conhecidas (decidir: aceitar vs corrigir)

Documentadas em código/PR mas sem owner. Cada uma é uma decisão técnica pendente.

- **cardForm não re-monta no cupom aplicado**: se o cart total muda no Step 4 (cupom) após o cardForm já ter montado no Step 3, o display de parcelas no SDK MP fica com o valor antigo. A tokenização funciona normalmente (o backend recebe o valor correto via `payment-intent`). Opções: (a) aceitar; (b) mover aplicação de cupom pra antes do Step 3; (c) destruir/remontar cardForm quando `cartTotal` muda (reabre o risco de "Context expirationFields already exists").

- **Cross-tab cart sync sem BroadcastChannel**: a dedup por token cobre 99% (server-side + client `lastMerged`). Edge: user com 2 abas em guest mode adiciona item em uma — a outra não vê até reload. Custo de fix: ~20 linhas com `BroadcastChannel("luratha-cart")`.

- **AuthUser não tem CPF**: pre-fill do `identificationNumber` no PaymentStep depende do user já ter cadastrado `taxIdentity` em algum lugar. Hoje signup não pede. 1ª compra de cada user tem CPF vazio. Opções: (a) pedir CPF no signup; (b) banner no Step 3 sugerindo "Salvar pra próxima compra"; (c) manter como está.

- **Cap 50 distintos no cart sem msg amigável**: `MAX_DISTINCT_ITEMS` no `cartsRepository` rejeita o 51º item; UI mostra erro genérico. Adicionar mensagem específica.

- **Order sem rastreamento ativo**: schema tem `trackingCode/trackingUrl/shippedAt/deliveredAt`, mas admin preenche manualmente. Issue #80 Opção B (polling Melhor Envio) está aberta.

- **Reset de senha não testado live**: `/esqueci-senha` existe e usa `sendPasswordResetEmail` do Firebase Auth. Testar no Firebase pra confirmar que o email chega (config SMTP/template do Firebase Auth no console).

---

## 5. CI / infra (housekeeping)

> **Histórico**: `apphosting.yaml` populado com refs de secret MP em master (8feb3f8). Bug `auth/invalid-api-key` no login resolvido em PR #128 — o App Hosting injeta `FIREBASE_WEBAPP_CONFIG` automaticamente, não precisa mais dos 6 `NEXT_PUBLIC_FIREBASE_*` manuais.

- [ ] **Secrets MercadoPago no App Hosting**: `apphosting.yaml` já referencia `mercadopago-access-token`, `mercadopago-webhook-secret`, `mercadopago-public-key`. Falta criar cada um: `firebase apphosting:secrets:set <nome> --project luratha-96386` (valores no `.env` da raiz).
- [ ] **E2E na branch**: rodar `pnpm test:e2e` no CI (flaky local por causa do Turbopack cold start). Confirmar que `checkout.spec.ts` passa contra `luratha-96386`.
- [x] **`pnpm build` local passa** com as deps novas (`react-hook-form`, `@hookform/resolvers`). Nesta máquina exige `NODE_OPTIONS=--use-system-ca` (interceptação TLS do Norton). Falta confirmar o build no ambiente do App Hosting com as env vars acima.
- [ ] **Webhook URL em produção**: setar `MERCADOPAGO_WEBHOOK_URL` no env do backend Firebase apontando pra URL pública do App Hosting.

---

## Decisões em aberto (review)

- Wishlist vale o esforço **agora** (pré-launch) ou só pós-launch?
- Páginas institucionais — quem escreve o copy? Precisa de legal review pra privacidade/termos?
- Polling Melhor Envio (issue #80 Opção B) — investir agora ou deixar tracking manual mais tempo?

---

## Como usar este doc

1. Usuário testa cada item à medida que sobe no Firebase.
2. Conforme valida, marca `[x]` e commita direto na branch (`docs: checklist updates`).
3. Bugs encontrados viram comments no draft PR ou issues novas.
4. Quando seções 1 + 2 estiverem ✅, este PR vira ready for review e é mergeado. Seções 3 + 4 viram backlog.
