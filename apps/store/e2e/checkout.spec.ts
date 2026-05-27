import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Checkout — fluxos PIX e Boleto.
 *
 * O usuário fixture é criado uma vez pelo `playwrightCloudSetup.globalSetup.ts`
 * (idempotente entre runs), e a sessão `__session` correspondente é gravada
 * em `playwright/.auth/storageState.json` — todo teste começa logado.
 * Sem credenciais Firebase no ambiente, os tests de happy-path pulam sozinhos.
 *
 * O fluxo de cartão vive em `checkout-card.spec.ts` porque depende do mock do
 * Brick (gated em `NEXT_PUBLIC_E2E_MOCK_MP_BRICK=1`).
 */

const FIXTURE_UID = process.env.E2E_FIXTURE_UID ?? "";

// ── Fixtures ────────────────────────────────────────────────────────────────

type E2ECartItem = {
  id: string;
  userId: string;
  productId: string;
  variantSku: string;
  productSlug: string;
  name: string;
  photoId: string;
  imageUrl: string;
  variantLabel?: string;
  unitPrice: number;
  quantity: number;
  currency: "BRL";
  dimensions: null;
  addedAt: string;
  updatedAt: string;
};

const FIXTURE_ADDRESS = {
  id: "addr-checkout-e2e",
  userId: "REPLACE_UID",
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

const FIXTURE_QUOTES = {
  quotes: [
    {
      providerId: "melhor-envio",
      serviceCode: "1",
      carrier: "Correios",
      service: "PAC",
      price: 22,
      estimatedDays: 7,
    },
    {
      providerId: "melhor-envio",
      serviceCode: "2",
      carrier: "Correios",
      service: "SEDEX",
      price: 38,
      estimatedDays: 3,
    },
  ],
  freeShippingThreshold: 500,
  referenceShippingCost: 22,
  resolvedProviderId: "melhor-envio",
  usedFallback: false,
};

const FIXTURE_PAYMENT_INTENT_PIX = {
  paymentId: "mp-e2e-pix-001",
  paymentMethod: "pix",
  status: "pending",
  pix: {
    qrCode: "00020126580014BR.GOV.BCB.PIX0136fake-pix-e2e",
    qrCodeBase64:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII=",
  },
};

const FIXTURE_PAYMENT_INTENT_BOLETO = {
  paymentId: "mp-e2e-bol-001",
  paymentMethod: "boleto",
  status: "pending",
  boleto: {
    url: "https://www.mercadopago.com.br/payments/boleto-e2e.pdf",
    digitableLine: "03399.65327 65000.000124 12100.456789 1 12345678901234",
  },
};

function buildCartItem(over: Partial<E2ECartItem> = {}): E2ECartItem {
  const now = new Date().toISOString();
  return {
    id: "prod-vest-1__var-m",
    userId: "guestcart",
    productId: "prod-vest-1",
    variantSku: "VEST_MARINA_M",
    productSlug: "vestido-marina",
    name: "Vestido Marina",
    photoId: "prod-vest-1-photo-1",
    imageUrl:
      "https://firebasestorage.googleapis.com/v0/b/luratha-test/o/vestido-marina.jpg?alt=media",
    variantLabel: "M",
    unitPrice: 250,
    quantity: 1,
    currency: "BRL",
    dimensions: null,
    addedAt: now,
    updatedAt: now,
    ...over,
  };
}

async function seedCart(page: Page, items: E2ECartItem[]) {
  await page.addInitScript((cartItems) => {
    localStorage.setItem("luratha_cart_v2", JSON.stringify(cartItems));
  }, items);
}

interface MockCheckoutOptions {
  /** Fixture devolvida em `POST /api/checkout/payment-intent`. */
  paymentIntentResponse: unknown;
}

async function mockCheckoutApis(page: Page, uid: string, options: MockCheckoutOptions) {
  const addressForUser = { ...FIXTURE_ADDRESS, userId: uid };

  // GET addresses
  await page.route(`**/api/users/${uid}/addresses`, async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([addressForUser]),
      });
      return;
    }
    await route.continue();
  });

  // PATCH UserProfile (persistência do step "Seus dados"). GET continua
  // passando pro server real (CheckoutFlow tenta carregar perfil pra pré-popular
  // o form e tolera 404 / erro silenciosamente).
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
      body: JSON.stringify(FIXTURE_QUOTES),
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
          id: "order-e2e-001",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.route("**/api/checkout/payment-intent", async (route: Route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(options.paymentIntentResponse),
    });
  });
}

async function fillIdentificationAndAdvanceToPayment(page: Page) {
  await expect(page.getByRole("heading", { name: "Seus dados" })).toBeVisible();
  // Nome/email já vêm do user fixture; preenchemos CPF.
  await page.getByLabel("Número do documento").fill("12345678909");
  await page.getByRole("button", { name: /Continuar/ }).click();

  await expect(page.getByRole("heading", { name: /Para onde enviamos/ })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: /Como você quer receber/ })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Revise antes de pagar" })).toBeVisible();
  await page.getByRole("button", { name: /Continuar para pagamento/ }).click();

  await expect(page.getByRole("heading", { name: /Como você quer pagar/ })).toBeVisible();
}

// ── Tests sem auth (proxy + UI estática) ────────────────────────────────────

test.describe("Checkout — guards e UI", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

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

// ── Happy paths (storageState + APIs mockadas) ──────────────────────────────

test.describe("Checkout — happy paths", () => {
  test.beforeEach(() => {
    test.skip(
      !FIXTURE_UID,
      "E2E_FIXTURE_UID ausente — globalSetup pulou (sem credenciais Firebase).",
    );
  });

  test("PIX: 5 steps → PaymentResult com QR Code", async ({ page }) => {
    await mockCheckoutApis(page, FIXTURE_UID, {
      paymentIntentResponse: FIXTURE_PAYMENT_INTENT_PIX,
    });
    await seedCart(page, [buildCartItem({ userId: FIXTURE_UID })]);

    await page.goto("/checkout");
    await fillIdentificationAndAdvanceToPayment(page);

    // Tab PIX é o default.
    await page.getByRole("button", { name: "Gerar PIX" }).click();

    await expect(
      page.getByRole("img", { name: "QR Code para pagamento PIX" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/checkout\?step=payment/);

    await page.getByRole("button", { name: "Acompanhar pedido" }).click();
    await expect(page).toHaveURL(/\/checkout\/sucesso\/[^/?]+$/);
  });

  test("Boleto: 5 steps → PaymentResult com link do boleto", async ({ page }) => {
    await mockCheckoutApis(page, FIXTURE_UID, {
      paymentIntentResponse: FIXTURE_PAYMENT_INTENT_BOLETO,
    });
    await seedCart(page, [buildCartItem({ userId: FIXTURE_UID })]);

    await page.goto("/checkout");
    await fillIdentificationAndAdvanceToPayment(page);

    // Troca para tab Boleto.
    await page.getByRole("tab", { name: "Boleto" }).click();
    await page.getByRole("button", { name: "Gerar boleto" }).click();

    await expect(
      page.getByRole("link", { name: "Abrir boleto em PDF" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/checkout\?step=payment/);

    await page.getByRole("button", { name: "Acompanhar pedido" }).click();
    await expect(page).toHaveURL(/\/checkout\/sucesso\/[^/?]+$/);
  });
});
