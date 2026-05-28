import { test, expect } from "@playwright/test";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { firestoreCollections } from "@luratha/schemas";
import { loginOrRegisterTestUser } from "./_authHelpers";
import {
  seedFixtureCart,
  clearFixtureCart,
  waitForCartHydrated,
  goToCheckoutViaCart,
} from "./_cartHelpers";
import {
  clearUserAddresses,
  clearPendingOrdersFor,
} from "./_userStateHelpers";

/**
 * Checkout cartão — fluxo end-to-end SEM mocks.
 *
 * Cobre o caminho real ponta-a-ponta: address criado via formulário,
 * `/api/checkout/shipping` consultado de verdade (provider Melhor Envio),
 * `/api/orders` cria Order no Firestore, Brick tokeniza contra MP,
 * `/api/checkout/payment-intent` dispara `POST /v1/orders` (MP server-side)
 * com cardToken real. Cartão APRO → MP responde `processed` SÍNCRONO →
 * server mapeia pra `paid` → redirect `/checkout/sucesso/{orderId}`.
 *
 * Diferenças vs `checkout-card.spec.ts` (com mocks):
 *  - Sem `page.route` em nenhum endpoint
 *  - Address criado via UI (`/api/users/{uid}/addresses` real)
 *  - Frete via Melhor Envio real
 *  - Order persistida no Firestore real (`orders/{orderId}`)
 *  - Payment-intent dispara MP server, persiste `paymentIntentId` na Order
 *
 * Webhook NÃO é necessário pra APRO — o status volta síncrono no response
 * (ver `mercadoPago/index.ts` mapMpStatus("processed") → "paid"). PIX/Boleto
 * ficam fora desse spec porque dependem de webhook (não chega em localhost).
 *
 * Env vars são validadas no `beforeAll` do describe principal com `throw` —
 * quem rodar o spec sem configurar vê uma mensagem clara. Escopo no
 * describe pra não abortar outros specs do mesmo `playwright test` run
 * (e.g. guards orthogonais em outros arquivos) por module-load throw.
 */

const REQUIRED_ENVS = [
  "TEST_USER_EMAIL",
  "TEST_USER_PASSWORD",
  "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY",
  "MERCADOPAGO_ACCESS_TOKEN",
  "MERCADOPAGO_ENV",
  "MERCADOPAGO_SANDBOX_PAYER_EMAIL",
  // Step 3 (Frete) bate em /api/checkout/shipping → provider Melhor Envio
  // real. Sem token, response retorna alert "MELHOR_ENVIO_TOKEN não
  // configurado" e o radiogroup nunca renderiza.
  "MELHOR_ENVIO_TOKEN",
] as const;

test.describe("Checkout — cartão real (end-to-end sem mocks)", () => {
  // login + UI + Brick mount + tokenize + payment-intent real + frete real.
  // 120s pra cobrir provider de frete eventualmente lento.
  // `mode: 'serial'` no describe (não no file scope) pra não vazar pra
  // outros describes/files que rodem na mesma invocação do Playwright.
  test.describe.configure({ timeout: 120_000, mode: "serial" });

  test.beforeAll(() => {
    const missingEnvs = REQUIRED_ENVS.filter((k) => !process.env[k]);
    if (missingEnvs.length > 0) {
      throw new Error(
        `[checkout-card-real] env vars obrigatórios ausentes: ${missingEnvs.join(", ")}. ` +
          `Configure no .env do repo root antes de rodar este spec.`,
      );
    }
  });

  let uid: string | null = null;

  test.beforeEach(async ({ page }) => {
    // Log do código de erro do Brick (caso `onError` dispare) — ver
    // `PaymentStep.tsx` que loga `[mp-brick-error] {...}` com cause/code.
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`[browser:${msg.type()}] ${msg.text()}`);
      }
    });
    // Surface 4xx/5xx do MP + payment-intent + orders + shipping pra debug
    // sem ruído em sucesso.
    page.on("response", (res) => {
      const url = res.url();
      const relevant =
        url.includes("mercadopago.com") ||
        url.includes("/api/checkout/") ||
        url.includes("/api/orders") ||
        url.includes("/api/users/");
      if (res.status() >= 400 && relevant) {
        res.text().then(
          (body) =>
            console.log(
              `[network:error] ${res.status()} ${res.request().method()} ${url} :: ${body.slice(0, 400)}`,
            ),
          () =>
            console.log(
              `[network:error] ${res.status()} ${res.request().method()} ${url} :: <body unavailable>`,
            ),
        );
      }
    });

    uid = await loginOrRegisterTestUser(page);

    // Cleanup pré-test: zera cart, endereços e orders pendentes do test user.
    // Mesmo user é reaproveitado entre runs, então state residual de
    // execuções anteriores pode atrapalhar (endereço já cadastrado força a
    // UI a renderizar lista em vez de formulário; orders pendentes acumulam).
    await clearFixtureCart(uid);
    await clearUserAddresses(uid);
    await clearPendingOrdersFor(uid);
  });

  test.afterEach(async () => {
    if (!uid) return;
    // Cleanup pós-test: same set, garante limpeza mesmo após falha.
    // NÃO deleta Orders pagas — preserva histórico real do test user.
    await clearFixtureCart(uid);
    await clearUserAddresses(uid);
    await clearPendingOrdersFor(uid);
  });

  test("fluxo completo: address + frete + order + cartão APRO", async ({
    page,
  }) => {
    if (!uid) throw new Error("uid não capturado no beforeEach");

    await seedFixtureCart(uid);
    await waitForCartHydrated(page);
    await goToCheckoutViaCart(page);

    // Step 1 — Seus dados (CPF padrão APRO).
    await expect(page.getByRole("heading", { name: "Seus dados" })).toBeVisible();
    await page.getByLabel("Número do documento").fill("12345678909");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.waitForURL(/[?&]step=address/, { timeout: 10_000 });

    // Step 2 — Endereço novo via UI. User sem endereços → form em vez de
    // lista. Sem auto-fill por CEP no AddressForm, preenchemos tudo manual.
    await expect(
      page.getByRole("heading", { name: /Para onde enviamos/i }),
    ).toBeVisible();
    await page.getByLabel("Nome do destinatário").fill("MP Test User");
    await page.getByLabel("CEP").fill("01310100");
    await page.getByLabel("UF").selectOption("SP");
    await page.getByLabel("Logradouro").fill("Av. Paulista");
    await page.getByLabel("Número").fill("1578");
    await page.getByLabel("Bairro").fill("Bela Vista");
    await page.getByLabel("Cidade").fill("São Paulo");

    // Submit do form dispara POST real /api/users/{uid}/addresses → 201 →
    // como é o 1º endereço (wasInitiallyEmpty), AddressStep chama onContinue()
    // direto: vai pro Frete sem mostrar lista nem botão Continuar.
    await page.getByRole("button", { name: "Salvar endereço" }).click();
    await page.waitForURL(/[?&]step=shipping/, { timeout: 15_000 });

    // Step 3 — Frete real (provider Melhor Envio). Quotes chegam via
    // /api/checkout/shipping. Aguardamos pelo menos uma opção renderizar e
    // clicamos Continuar (a primeira é checked por default).
    await expect(
      page.getByRole("heading", { name: /Como você quer receber/i }),
    ).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: /frete/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.waitForURL(/[?&]step=review/, { timeout: 10_000 });

    // Step 4 — Revisão. "Continuar para pagamento" apenas navega pra Step 5
    // (não cria Order). A Order só é criada no submit do Brick (Step 5):
    // `confirmOrder()` em CheckoutFlow.tsx:339-413 faz POST /api/orders
    // DEPOIS do tokenize, sequencialmente com POST /api/checkout/payment-intent.
    await expect(
      page.getByRole("heading", { name: /Revise antes de pagar/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Continuar para pagamento/ }).click();
    await page.waitForURL(/[?&]step=payment/, { timeout: 10_000 });

    // Step 5 — Pagamento. Tab Cartão → Brick real.
    await expect(page.getByRole("heading", { name: /Como você quer pagar/ })).toBeVisible();
    await page.getByRole("tab", { name: "Cartão" }).click();
    await expect(
      page.getByText(/Carregando ambiente seguro/i),
    ).toBeHidden({ timeout: 30_000 });

    // Preencher PAN dispara fetch async pra `installments?bin=...`. Brick
    // re-renderiza populando combobox de parcelas — esse re-render reseta
    // inputs externos preenchidos antes (cardholder, doc). Aguardamos o
    // settle ANTES de preencher os demais.
    const installmentsLoaded = page.waitForResponse(
      (res) =>
        res.url().includes("/payment_methods/installments") && res.status() === 200,
      { timeout: 15_000 },
    );
    await page
      .frameLocator('iframe[name="cardNumber"]')
      .getByLabel("Número do cartão")
      .fill("5031433215406351");
    await installmentsLoaded;

    await page
      .frameLocator('iframe[name="expirationDate"]')
      .getByLabel("Data de vencimento")
      .fill("1130");
    await page
      .frameLocator('iframe[name="securityCode"]')
      .getByLabel("Código de segurança")
      .fill("123");

    await page.getByPlaceholder("Maria Santos Pereira").fill("APRO");

    // Installments select: escopado pela heading "Selecione o número de
    // parcelas" pra não colidir com outro <select> (doc-type CPF/CNPJ tem
    // role combobox e usar `filter({ hasText: "À Vista" })` seria landmine
    // caso o Brick adicione outro select com options contendo "À Vista").
    const installmentsSelect = page
      .locator(
        'h2:has-text("Selecione o número de parcelas") ~ * select, h2:has-text("Selecione o número de parcelas") + * select',
      )
      .first();
    await expect(installmentsSelect).toBeVisible({ timeout: 5_000 });
    await installmentsSelect.selectOption({ index: 1 });

    // Submit do Brick → tokenize real → confirmOrder() em CheckoutFlow.tsx
    // dispara: (1) POST /api/orders cria Order com paymentStatus=pending,
    // (2) POST /api/checkout/payment-intent com cardToken → adapter MP →
    // mapMpStatus("processed") → "paid" → handler persiste paymentIntentId
    // e paymentStatus="paid", (3) clearCart() + window.location.assign(/checkout/sucesso/{id}).
    //
    // Captura o orderId da response do POST /api/orders pra asserir Firestore
    // depois. Configurar `waitForResponse` ANTES do click pra não perder.
    const orderResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/orders") &&
        res.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: /Pagar/i }).click();

    const orderResp = await orderResponse;
    expect(orderResp.status()).toBe(201);
    const orderData = (await orderResp.json()) as { id: string };
    const orderId = orderData.id;
    expect(orderId).toMatch(/.+/);
    console.log(`[order] criado: ${orderId}`);

    await expect(page).toHaveURL(
      new RegExp(`/checkout/sucesso/${orderId}`),
      { timeout: 60_000 },
    );

    // Asserções no Firestore: Order ficou com paymentStatus=paid +
    // paymentIntentId setado (server persistiu via `createPaymentIntent`
    // service após o adapter MP).
    const orderDoc = await adminDb
      .collection(firestoreCollections.orders)
      .doc(orderId)
      .get();
    expect(orderDoc.exists).toBe(true);
    const order = orderDoc.data();
    expect(order?.paymentStatus).toBe("paid");
    // MP Orders API retorna `paymentIntentId` no formato `ORDTST01...` (sandbox)
    // ou `ORD01...` (prod). `/.+/` aceitaria qualquer placeholder; o prefixo
    // `^ORD` valida que veio do MP de verdade.
    expect(order?.paymentIntentId).toMatch(/^ORD/i);
    console.log(
      `[order] final: paymentStatus=${order?.paymentStatus} paymentIntentId=${order?.paymentIntentId}`,
    );

    // Cart limpo pelo CheckoutFlow.clearCart() pós-sucesso.
    const cartDoc = await adminDb
      .collection(firestoreCollections.carts)
      .doc(uid)
      .get();
    expect(cartDoc.exists).toBe(false);
  });
});
