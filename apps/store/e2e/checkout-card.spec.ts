import { test, expect, type Route } from "@playwright/test";
import { registerNewUser } from "./_authHelpers";
import { seedFixtureCart } from "./_cartHelpers";

/**
 * Checkout — fluxo de cartão (com mock do Brick).
 *
 * Por que separado de `checkout.spec.ts`: o `<CardPayment>` do MercadoPago
 * **não roda em localhost** (servidor MP rejeita CORS de domínios locais —
 * ver `.github/skills/mercadopago-payments/SKILL.md`). Em CI o componente é
 * substituído por um form data-testid="mp-brick-mock" via
 * `NEXT_PUBLIC_E2E_MOCK_MP_BRICK=1`, que devolve um cardToken fixo. Esse spec
 * exercita o handoff client → `/api/checkout/payment-intent` → PaymentResult;
 * a tokenização real é coberta por `paymentApi.cloud.test.ts` no server.
 */

const SKIP_CLOUD = process.env.E2E_CLOUD_SKIP === "1";
const MOCK_ENABLED = process.env.NEXT_PUBLIC_E2E_MOCK_MP_BRICK === "1";

const FIXTURE_PAYMENT_INTENT_CARD_PAID = {
  paymentId: "mp-e2e-card-001",
  paymentMethod: "credit_card",
  status: "paid",
};

async function mockCheckoutApis(page: import("@playwright/test").Page, uid: string) {
  const address = {
    id: "addr-card-e2e",
    userId: uid,
    label: "Casa",
    recipientName: "Marina Souza",
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
}

test.describe("Checkout — cartão (Brick mockado)", () => {
  test.beforeEach(() => {
    test.skip(
      SKIP_CLOUD,
      "E2E_CLOUD_SKIP=1 — sem credenciais Firebase, globalSetup pulou.",
    );
    test.skip(
      !MOCK_ENABLED,
      "NEXT_PUBLIC_E2E_MOCK_MP_BRICK não está '1' — Brick real não funciona em localhost.",
    );
  });

  test("submit do cartão envia cardToken correto e PaymentResult mostra Aprovado", async ({
    page,
  }) => {
    const uid = await registerNewUser(page);
    await mockCheckoutApis(page, uid);
    await seedFixtureCart(uid);

    // Intercepta payment-intent e captura o body submetido pra assertion.
    let capturedBody: Record<string, unknown> | null = null;
    await page.route("**/api/checkout/payment-intent", async (route: Route) => {
      capturedBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(FIXTURE_PAYMENT_INTENT_CARD_PAID),
      });
    });

    await page.goto("/checkout");

    // Step 1 — Seus dados.
    await expect(page.getByRole("heading", { name: "Seus dados" })).toBeVisible();
    await page.getByLabel("Número do documento").fill("12345678909");
    await page.getByRole("button", { name: /Continuar/ }).click();

    // Steps 2-4 (endereço, frete, revisão).
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: /Continuar para pagamento/ }).click();

    // Tab Cartão → mock brick → submit.
    await expect(page.getByRole("heading", { name: /Como você quer pagar/ })).toBeVisible();
    await page.getByRole("tab", { name: "Cartão" }).click();
    await expect(page.getByTestId("mp-brick-mock")).toBeVisible();

    await page.getByTestId("mp-brick-mock-installments").selectOption("3");
    await page.getByTestId("mp-brick-mock-submit").click();

    // Result — cartão pago, badge "Pagamento aprovado".
    await expect(page.getByText("Pagamento aprovado")).toBeVisible({ timeout: 10000 });

    // Confirma o handoff client → server.
    expect(capturedBody).not.toBeNull();
    expect(capturedBody).toMatchObject({
      paymentMethod: "credit_card",
      cardToken: "e2e-mock-card-token",
      installments: 3,
      paymentMethodId: "master",
    });
  });
});
