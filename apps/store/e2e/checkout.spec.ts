import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Checkout end-to-end.
 *
 * O caminho feliz exige login real (Firebase Auth) + cookie `__session`
 * válido, porque o `src/proxy.ts` faz presence-check antes da página rodar.
 * Por isso, o teste completo é gated em `E2E_LIVE_AUTH=1` — mesmo padrão de
 * `e2e/auth.spec.ts`.
 *
 * As assertions de redirect (proxy) e UI estática rodam sempre — não exigem
 * Firebase.
 */

const hasLiveAuth = process.env.E2E_LIVE_AUTH === "1";

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
  paymentId: "mp-e2e-001",
  paymentMethod: "pix",
  status: "pending",
  pix: {
    qrCode: "00020126580014BR.GOV.BCB.PIX0136fake-pix-e2e",
    qrCodeBase64:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII=",
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

async function mockCheckoutApis(page: Page, uid: string) {
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
      body: JSON.stringify(FIXTURE_PAYMENT_INTENT_PIX),
    });
  });
}

// ── Tests sem auth (proxy + UI estática) ────────────────────────────────────

test.describe("Checkout — guards e UI", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

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

// ── Happy path (live Firebase + cart mockado) ───────────────────────────────

test.describe("Checkout — fluxo PIX mockado", () => {
  test("login → cart → 4 steps → PaymentResult com QR PIX", async ({ page }) => {
    test.skip(
      !hasLiveAuth,
      "Set E2E_LIVE_AUTH=1 to run the live-Firebase checkout test",
    );

    // 1. Registra novo usuário
    await page.goto("/register");
    const uniqueEmail = `__test_checkout_${Date.now()}@luratha.com`;
    await page.getByLabel("Nome completo").fill("Marina Souza");
    await page.getByLabel("E-mail").fill(uniqueEmail);
    await page.getByLabel("Senha", { exact: true }).fill("senha123");
    await page.getByLabel("Confirmar senha").fill("senha123");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.waitForURL("/");

    // 2. Captura o uid via API
    const uid = await page.evaluate(async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.uid as string;
    });
    if (!uid) throw new Error("Não foi possível recuperar o uid após registro.");

    // 3. Mocka as APIs do checkout + popula carrinho
    await mockCheckoutApis(page, uid);
    await seedCart(page, [buildCartItem({ userId: uid })]);

    // 4. Entra no checkout
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: /Para onde enviamos/ })).toBeVisible();

    // Step 1 — Endereço (auto-seleciona o default, basta clicar Continuar)
    await page.getByRole("button", { name: "Continuar" }).click();

    // Step 2 — Frete
    await expect(page.getByRole("heading", { name: /Como você quer receber/ })).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();

    // Step 3 — Pagamento (PIX selecionado por padrão)
    await expect(page.getByRole("heading", { name: /Como você quer pagar/ })).toBeVisible();
    await page.getByLabel("E-mail do pagador").fill(uniqueEmail);
    await page.getByLabel("Número do documento").fill("12345678909");
    await page.getByRole("button", { name: "Confirmar pagamento" }).click();

    // Step 4 — Revisão
    await expect(page.getByRole("heading", { name: "Revise antes de pagar" })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar pedido" }).click();

    // Result — QR PIX renderizado
    await expect(
      page.getByRole("img", { name: "QR Code para pagamento PIX" }),
    ).toBeVisible({ timeout: 10000 });

    // Steps refletem na URL agora (?step=review depois do submit, com a view
    // de result derivada de paymentResult em memória).
    await expect(page).toHaveURL(/\/checkout\?step=review/);

    // "Acompanhar pedido" deve aterrissar em /checkout/sucesso/{id} —
    // antes a race com clearCart mandava o user pro /carrinho.
    await page.getByRole("button", { name: "Acompanhar pedido" }).click();
    await expect(page).toHaveURL(/\/checkout\/sucesso\/[^/?]+$/);
  });
});
