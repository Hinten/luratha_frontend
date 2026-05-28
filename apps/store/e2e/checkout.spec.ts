import { test, expect, type Page } from "@playwright/test";
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
 * Checkout PIX e Boleto — fluxo end-to-end SEM mocks.
 *
 * Cobre o caminho real ponta-a-ponta até o status `pending` (com QR Code do
 * PIX ou link do boleto renderizados). Cartão APRO volta `processed → paid`
 * síncrono e tem spec próprio (`checkout-card-real.spec.ts`); PIX/Boleto
 * dependem de webhook do MP pra confirmar pagamento, e o webhook não chega
 * em `localhost` nem em runner do GitHub. Portanto:
 *
 * - Este spec PARA em `pending`: valida que /api/orders criou Order real
 *   no Firestore, que /api/checkout/payment-intent disparou o adapter MP
 *   (POST /v1/orders), que MP retornou `qrCode`/`boleto.url` e que a UI
 *   mostra PaymentResult com QR Code visível / link do boleto clicável.
 *   Asserta `Order.paymentStatus === "pending"` + `paymentIntentId` setado
 *   no Firestore (MP order id como ORDTST01...).
 *
 * - A cobertura do flow `webhook → paid` fica em
 *   `src/test/cloud/paymentApi.cloud.test.ts` (Vitest cloud, mocka
 *   `getOrder` do MP server-side pra simular o status atualizado).
 *
 * Reusa o MP test user (`loginOrRegisterTestUser`) — mesmo user em todos
 * os specs E2E que rodam em CI, sem criar lixo no Firestore. Cleanup
 * completo no beforeEach/afterEach: cart, endereços e orders pendentes
 * do test user são apagados pra runs idempotentes.
 *
 * Env vars validados no module-load com `throw` (sem `test.skip`) — sem
 * mensagem clara do que falta configurar.
 */

const REQUIRED_ENVS = [
  "TEST_USER_EMAIL",
  "TEST_USER_PASSWORD",
  "MERCADOPAGO_ACCESS_TOKEN",
  "MERCADOPAGO_ENV",
  "MERCADOPAGO_SANDBOX_PAYER_EMAIL",
] as const;

const missingEnvs = REQUIRED_ENVS.filter((k) => !process.env[k]);
if (missingEnvs.length > 0) {
  throw new Error(
    `[checkout pix/boleto] env vars obrigatórios ausentes: ${missingEnvs.join(", ")}. ` +
      `Configure no .env do repo root antes de rodar este spec.`,
  );
}

// ── Tests sem auth (proxy + UI estática) ────────────────────────────────────

test.describe("Checkout — guards e UI", () => {
  test("acesso sem sessão redireciona para /login?redirect=%2Fcheckout", async ({
    page,
  }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/);
  });

  test("acesso sem sessão à página de sucesso redireciona com path completo", async ({
    page,
  }) => {
    await page.goto("/checkout/sucesso/order-x");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout%2Fsucesso%2Forder-x/);
  });
});

// ── Happy paths real (end-to-end sem mocks, para em pending) ────────────────

test.describe.configure({ mode: "serial" });

test.describe("Checkout — PIX/Boleto real (end-to-end sem mocks)", () => {
  // Login + UI + frete real + Order real + payment-intent real.
  // 120s pra cobrir provider de frete eventualmente lento + MP API.
  test.describe.configure({ timeout: 120_000 });

  let uid: string | null = null;

  test.beforeEach(async ({ page }) => {
    // Surface console errors pra debug (ex.: `[mp-brick-error]` futuro).
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`[browser:${msg.type()}] ${msg.text()}`);
      }
    });
    // Log apenas 4xx/5xx em rotas relevantes — sem ruído em sucesso.
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

    // Cleanup pré-test: state residual do MP test user (reaproveitado entre
    // runs) precisa ser limpo pra a UI renderizar o formulário de novo
    // endereço (não a lista) e pra não acumular orders pending.
    await clearFixtureCart(uid);
    await clearUserAddresses(uid);
    await clearPendingOrdersFor(uid);
  });

  test.afterEach(async () => {
    if (!uid) return;
    // Cleanup pós-test: garante limpeza mesmo após falha. Preserva orders
    // pagas (paymentStatus !== "pending") como histórico real do test user.
    await clearFixtureCart(uid);
    await clearUserAddresses(uid);
    await clearPendingOrdersFor(uid);
  });

  /**
   * Roda steps 1-4 (CPF → novo endereço via UI → frete real → revisão) e
   * deixa o user no Step 5 (Pagamento) com a tab default (PIX) ativa.
   * Cada test escolhe o método e dispara o submit.
   */
  async function navigateToPaymentStep(page: Page): Promise<void> {
    if (!uid) throw new Error("uid não capturado no beforeEach");

    await seedFixtureCart(uid);
    await waitForCartHydrated(page);
    await goToCheckoutViaCart(page);

    // Step 1 — Seus dados (CPF padrão APRO).
    await expect(page.getByRole("heading", { name: "Seus dados" })).toBeVisible();
    await page.getByLabel("Número do documento").fill("12345678909");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.waitForURL(/[?&]step=address/, { timeout: 10_000 });

    // Step 2 — Endereço novo via UI (`AddressStep` renderiza form quando o
    // user não tem endereços; o `clearUserAddresses` no beforeEach garante).
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
    await page.getByRole("button", { name: "Salvar endereço" }).click();
    await page.waitForURL(/[?&]step=shipping/, { timeout: 15_000 });

    // Step 3 — Frete real (provider Melhor Envio).
    await expect(
      page.getByRole("heading", { name: /Como você quer receber/i }),
    ).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: /frete/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.waitForURL(/[?&]step=review/, { timeout: 10_000 });

    // Step 4 — Revisão.
    await expect(
      page.getByRole("heading", { name: /Revise antes de pagar/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Continuar para pagamento/ }).click();
    await page.waitForURL(/[?&]step=payment/, { timeout: 10_000 });

    // Step 5 — Pagamento (caller escolhe método).
    await expect(
      page.getByRole("heading", { name: /Como você quer pagar/ }),
    ).toBeVisible();
  }

  /**
   * Asserções comuns no Firestore após `confirmOrder()` em CheckoutFlow.tsx:
   * Order criada via POST /api/orders + payment-intent atualizou
   * `paymentStatus`/`paymentIntentId` via service real (handler em
   * `app/api/checkout/payment-intent/post.ts` chama `createPaymentIntent`).
   */
  async function assertOrderPersisted(
    orderId: string,
    expected: { paymentMethod: "pix" | "boleto" },
  ) {
    const orderDoc = await adminDb
      .collection(firestoreCollections.orders)
      .doc(orderId)
      .get();
    expect(orderDoc.exists).toBe(true);
    const order = orderDoc.data();
    expect(order?.paymentStatus).toBe("pending");
    expect(order?.paymentMethod).toBe(expected.paymentMethod);
    expect(order?.paymentIntentId).toMatch(/.+/);
    console.log(
      `[${expected.paymentMethod} order] final: paymentStatus=${order?.paymentStatus} paymentIntentId=${order?.paymentIntentId}`,
    );
  }

  test("PIX: order pending + QR Code real", async ({ page }) => {
    if (!uid) throw new Error("uid não capturado");

    await navigateToPaymentStep(page);

    // PIX é a tab default — só clica "Gerar PIX". Configurar wait do POST
    // /api/orders ANTES do click pra não perder a response (confirmOrder
    // executa: POST /api/orders → POST /api/checkout/payment-intent → MP).
    const orderResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/orders") &&
        res.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: "Gerar PIX" }).click();

    const orderResp = await orderResponse;
    expect(orderResp.status()).toBe(201);
    const { id: orderId } = (await orderResp.json()) as { id: string };
    expect(orderId).toMatch(/.+/);
    console.log(`[pix order] criado: ${orderId}`);

    // PaymentResult: QR Code img (base64 real do MP) + botão "Copiar código".
    await expect(
      page.getByRole("img", { name: "QR Code para pagamento PIX" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: /Copiar código/ }),
    ).toBeVisible();

    await assertOrderPersisted(orderId, { paymentMethod: "pix" });
  });

  test("Boleto: order pending + link do boleto real", async ({ page }) => {
    if (!uid) throw new Error("uid não capturado");

    await navigateToPaymentStep(page);

    // Troca pra tab Boleto.
    await page.getByRole("tab", { name: "Boleto" }).click();

    const orderResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/orders") &&
        res.request().method() === "POST",
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: "Gerar boleto" }).click();

    const orderResp = await orderResponse;
    expect(orderResp.status()).toBe(201);
    const { id: orderId } = (await orderResp.json()) as { id: string };
    expect(orderId).toMatch(/.+/);
    console.log(`[boleto order] criado: ${orderId}`);

    // PaymentResult: link "Abrir boleto em PDF" com URL real do MP.
    await expect(
      page.getByRole("link", { name: "Abrir boleto em PDF" }),
    ).toBeVisible({ timeout: 30_000 });

    await assertOrderPersisted(orderId, { paymentMethod: "boleto" });
  });
});
