import { test, expect, type Route } from "@playwright/test";
import { loginOrRegisterTestUser } from "./_authHelpers";
import {
  seedFixtureCart,
  waitForCartHydrated,
  goToCheckoutViaCart,
} from "./_cartHelpers";

/**
 * Checkout — fluxo de cartão com Brick REAL do MercadoPago.
 *
 * O `<CardPayment>` do `@mercadopago/sdk-react` carrega iframes hospedados em
 * `secure-fields.mercadopago.com` e a tokenização final (`POST /v1/card_tokens`)
 * sai do iframe direto pra MP. **Funciona em localhost** — a teoria antiga
 * de "MP rejeita CORS de localhost" foi refutada por logs (ver memo
 * `[[mp-brick-localhost-works]]`): o MP aceita normalmente, com
 * `referer=http://localhost:3000` no query string da request.
 *
 * Cobertura deste spec: tokenização REAL do Brick contra MP + handoff client
 * via /api/checkout/payment-intent. A Order não é criada no Firestore real
 * (mockada), então `/api/checkout/payment-intent` server-side é mockado pra
 * fechar o flow client. A criação real da Order é coberta por
 * `paymentApi.cloud.test.ts`.
 *
 * Pré-requisitos no `.env` (repo root):
 *  - TEST_USER_EMAIL / TEST_USER_PASSWORD: MP test user (formato `*@testuser.com`)
 *  - NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: chave pública sandbox
 *  - MERCADOPAGO_ACCESS_TOKEN + MERCADOPAGO_ENV=sandbox: server-side
 *  - NÃO setar NEXT_PUBLIC_E2E_MOCK_MP_BRICK (queremos o Brick real)
 *
 * Cartão MLB (Brasil) APRO — Mastercard `5031 4332 1540 6351`, val `11/30`,
 * CVV `123`, nome impresso `APRO`, CPF `12345678909` (padrão APRO/OTHE).
 */

const SKIP_CLOUD = process.env.E2E_CLOUD_SKIP === "1";

async function mockCheckoutApis(page: import("@playwright/test").Page, uid: string) {
  const address = {
    id: "addr-card-e2e",
    userId: uid,
    label: "Casa",
    recipientName: "MP Test User",
    postalCode: "01310-100",
    line1: "Av. Paulista",
    number: "1578",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    country: "BR",
    isDefault: true,
  };

  await page.route(`**/api/users/${uid}/addresses`, async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([address]),
      });
      return;
    }
    await route.continue();
  });

  await page.route(`**/api/users/${uid}`, async (route: Route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.continue();
  });

  await page.route("**/api/checkout/shipping", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        quotes: [
          {
            providerId: "melhor-envio",
            serviceCode: "1",
            carrier: "Correios",
            service: "PAC",
            price: 22,
            estimatedDays: 7,
          },
        ],
        freeShippingThreshold: 500,
        referenceShippingCost: 22,
        resolvedProviderId: "melhor-envio",
        usedFallback: false,
      }),
    });
  });

  await page.route("**/api/orders", async (route: Route) => {
    if (route.request().method() === "POST") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ...body,
          id: "order-card-e2e-001",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
      return;
    }
    await route.continue();
  });

  // Mock do payment-intent: a Order é mockada acima (id "order-card-e2e-001"
  // nunca existe no Firestore real), então o handler server real retorna 404
  // "Pedido não encontrado". Mockamos a resposta paid pra fechar o fluxo
  // client → CheckoutFlow faz `window.location.assign("/checkout/sucesso/...")`.
  // A tokenização REAL do Brick (POST /v1/card_tokens direto pra MP) NÃO é
  // mockada — esse é o ponto interessante do spec: prova end-to-end no client
  // que o handoff do iframe → cardToken → nosso POST com o token funciona em
  // localhost. A criação real da Order server-side é coberta por
  // `paymentApi.cloud.test.ts`.
  await page.route("**/api/checkout/payment-intent", async (route: Route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        paymentId: "mp-e2e-card-001",
        paymentMethod: "credit_card",
        status: "paid",
      }),
    });
  });
}

test.describe("Checkout — cartão (Brick real)", () => {
  // Brick real demora ~2-5s pra montar os iframes seguros. 90s pra cobrir
  // login + UI + Brick mount + tokenize + payment-intent.
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(() => {
    test.skip(
      SKIP_CLOUD,
      "E2E_CLOUD_SKIP=1 — sem credenciais Firebase, globalSetup pulou.",
    );
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      "TEST_USER_EMAIL/PASSWORD ausentes — Brick real exige MP test user.",
    );
  });

  test("Brick real tokeniza cartão APRO e redireciona pra /checkout/sucesso", async ({
    page,
  }) => {
    // Surface console errors do Brick pra debug futuro — em particular
    // `[mp-brick-error]` (loggado pelo onError em PaymentStep.tsx) traz
    // o `cause`/code da MP quando o Brick rejeita algo (ver doc Bricks
    // "Possíveis erros": fields_setup_failed, card_token_creation_failed,
    // get_payment_methods_failed, etc.).
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`[browser:${msg.type()}] ${msg.text()}`);
      }
    });
    // Log apenas 4xx/5xx pra rotas MP + payment-intent — sem ruído em runs
    // bem-sucedidas, mas captura falhas que poderiam confundir o debug.
    page.on("response", (res) => {
      const url = res.url();
      if (
        res.status() >= 400 &&
        (url.includes("mercadopago.com") || url.includes("/api/checkout/payment-intent"))
      ) {
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

    const uid = await loginOrRegisterTestUser(page);
    await mockCheckoutApis(page, uid);
    await seedFixtureCart(uid);
    await waitForCartHydrated(page);

    await goToCheckoutViaCart(page);

    // Step 1 — Seus dados (CPF padrão APRO).
    await expect(page.getByRole("heading", { name: "Seus dados" })).toBeVisible();
    await page.getByLabel("Número do documento").fill("12345678909");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.waitForURL(/[?&]step=address/, { timeout: 10_000 });

    // Steps 2-4 (endereço mock → frete mock → revisão). Esperamos a URL
    // transitar antes do próximo click — Playwright actionability check
    // pode aceitar o botão do step anterior se a transição estiver no meio
    // do ciclo de render, resultando em click "no ar".
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.waitForURL(/[?&]step=shipping/, { timeout: 10_000 });

    await page.getByRole("button", { name: "Continuar" }).click();
    await page.waitForURL(/[?&]step=review/, { timeout: 10_000 });

    await page.getByRole("button", { name: /Continuar para pagamento/ }).click();
    await page.waitForURL(/[?&]step=payment/, { timeout: 10_000 });

    // Step 5 — Pagamento. Tab Cartão → Brick real.
    await expect(page.getByRole("heading", { name: /Como você quer pagar/ })).toBeVisible();
    await page.getByRole("tab", { name: "Cartão" }).click();

    // Aguarda Brick montar (PaymentStep tira o overlay quando onReady dispara).
    await expect(
      page.getByText(/Carregando ambiente seguro/i),
    ).toBeHidden({ timeout: 30_000 });

    // Iframes do Brick: cada campo seguro tem `name` único —
    // `cardNumber`, `expirationDate`, `securityCode` — direto no `<iframe>`.
    // Targeting via `name` é o caminho mais robusto (o `src` é igual pra
    // todos: secure-fields.mercadopago.com).
    //
    // Preencher PAN dispara fetch async do MP pra `payment_methods` +
    // `installments?bin=...`; o Brick re-renderiza com o combobox de parcelas
    // populado quando o response chega. Aguardamos esse settle ANTES de
    // mexer nos inputs externos pra evitar reset por re-render.
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

    // Nome do titular — input fora dos iframes (placeholder "Maria Santos
    // Pereira").
    await page.getByPlaceholder("Maria Santos Pereira").fill("APRO");

    // Documento do titular — pré-preenchido com `123.456.789-09` (vindo do
    // step "Seus dados" via initialization.payer.identification).

    // Parcelas — combobox <select> só renderiza depois do `installments`
    // fetch (já aguardamos acima). Filtro por "À Vista" pra não colidir com
    // doc-type (CPF/CNPJ) que também é role="combobox".
    const installmentsSelect = page
      .locator("select")
      .filter({ hasText: "À Vista" });
    await expect(installmentsSelect).toBeVisible({ timeout: 5_000 });
    await installmentsSelect.selectOption({ index: 1 });

    // Submit do Brick — botão "Pagar" interno.
    await page.getByRole("button", { name: /Pagar/i }).click();

    // Sucesso: tokenização OK + /api/checkout/payment-intent retornou paid →
    // CheckoutFlow.tsx faz window.location.assign para /checkout/sucesso/{id}.
    await expect(page).toHaveURL(/\/checkout\/sucesso\/[^/?]+$/, { timeout: 30_000 });
  });
});
