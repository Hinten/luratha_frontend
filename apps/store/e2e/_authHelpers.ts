import { errors, expect, type Page, type Response } from "@playwright/test";

/**
 * Registra um novo user via `/register` (UI) e retorna o uid.
 *
 * Por que registrar em vez de reusar um fixture user: o `CheckoutPage` é
 * client component e checa `useAuth().user` (estado do Firebase client SDK
 * em IndexedDB). Setar só o cookie `__session` cobre o proxy mas não o gate
 * client-side. Login via UI também populava o AuthContext, mas tivemos race
 * condition entre o snapshot inicial do `CartContext` (do user fixture, com
 * cart possivelmente pre-seeded) e o `seedFixtureCart` do teste — gerava
 * timeout em "Seus dados".
 *
 * Registrar um user novo cada vez é o padrão que o spec original usava com
 * `E2E_LIVE_AUTH=1` e funciona porque: (1) `createUserWithEmailAndPassword`
 * + `postSession` rodam dentro do `AuthContext.register()`, deixando cookie
 * + IndexedDB + UserProfile consistentes; (2) usuário fresco → cart Firestore
 * inicialmente vazio → snapshot inicial é empty → seedFixtureCart escreve →
 * snapshot refire com items. Sem race.
 *
 * Trade-off: ~3-4 users de lixo no projeto `luratha-96386` por PR run. Custo
 * baixo (Firebase aguenta milhões) e dá pra limpar periodicamente.
 */
export async function registerNewUser(page: Page): Promise<string> {
  const uniqueEmail = `__test_checkout_${Date.now()}_${Math.floor(Math.random() * 1e6)}@luratha.com`;

  await page.goto("/register");
  await page.getByLabel("Nome completo").fill("Marina Souza");
  await page.getByLabel("E-mail").fill(uniqueEmail);
  await page.getByLabel("Senha", { exact: true }).fill("senha123");
  await page.getByLabel("Confirmar senha").fill("senha123");

  // Captura o uid da resposta de POST /api/auth/session — feito pelo
  // AuthContext durante o register, retorna `{ uid, email, ... }`. Sem isso
  // o spec não consegue mockar `/api/users/{uid}/...` nem chamar
  // seedFixtureCart(uid). `/api/auth/me` não existe (a rota é `/session`).
  const sessionResponse = page.waitForResponse(
    (res) => res.url().includes("/api/auth/session") && res.request().method() === "POST",
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: "Criar conta" }).click();
  const response = await sessionResponse;
  if (!response.ok()) {
    throw new Error(`[E2E] /api/auth/session falhou no register (${response.status()}).`);
  }
  const data = (await response.json()) as { uid?: string };
  if (!data.uid) {
    throw new Error("[E2E] /api/auth/session retornou sem uid.");
  }

  await expect(page).toHaveURL("/", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible({
    timeout: 10_000,
  });

  return data.uid;
}

/**
 * Reaproveita um único MP test user (`TEST_USER_EMAIL` / `TEST_USER_PASSWORD`)
 * pra checkout-card. Em sandbox o MP exige que `payer.email` corresponda a um
 * test user criado no painel (`@testuser.com`); usar um email aleatório por
 * teste quebra a tokenização com erros disfarçados de CORS. Estratégia:
 *
 * 1. Tenta login. Se o `POST /api/auth/session` chegar com 200, captura o uid
 *    e segue.
 * 2. Se o login não emite a request em ~10s (login falha localmente sem hit no
 *    backend quando o email não existe — `signInWithEmailAndPassword` rejeita
 *    antes do `postSession`) **ou** responde com erro, cai pro `/register` com
 *    os mesmos creds. Em runs subsequentes o login passa direto.
 *
 * Mesmo path do `registerNewUser` pra estabelecer cookie `__session` + Firebase
 * IndexedDB + UserProfile consistentes antes de qualquer interação com checkout.
 */
export async function loginOrRegisterTestUser(page: Page): Promise<string> {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "[E2E] TEST_USER_EMAIL e TEST_USER_PASSWORD são obrigatórios para reaproveitar o MP test user.",
    );
  }

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  // `exact: true` evita strict-mode multi-match se a UI vier a expor toggles
  // tipo "Mostrar senha" ou "Senha forte". Alinha com o register flow abaixo
  // (linha equivalente em `Confirmar senha`).
  await page.getByLabel("Senha", { exact: true }).fill(password);

  const loginSessionWait = page.waitForResponse(
    (res) => res.url().includes("/api/auth/session") && res.request().method() === "POST",
    { timeout: 10_000 },
  );
  await page.getByRole("button", { name: "Entrar" }).click();

  let loginResponse: Response | null = null;
  try {
    loginResponse = await loginSessionWait;
  } catch (err) {
    // Playwright `waitForResponse` lança `errors.TimeoutError` quando o timeout
    // estoura. Capturamos só timeout (sinal de "request nunca aconteceu" — login
    // falhou client-side em signInWithEmailAndPassword antes do postSession);
    // outras exceções propagam.
    if (!(err instanceof errors.TimeoutError)) {
      throw err;
    }
  }

  if (loginResponse?.ok()) {
    const data = (await loginResponse.json()) as { uid?: string };
    if (!data.uid) {
      throw new Error("[E2E] /api/auth/session retornou sem uid (login).");
    }
    await expect(page).toHaveURL("/", { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible({
      timeout: 10_000,
    });
    return data.uid;
  }

  // Login retornou response com erro (não-OK) → user existe mas password/conta
  // estão errados. Falhar EXPLICITAMENTE em vez de cair pro register (que ia
  // dar timeout em 15s porque Firebase rejeita `auth/email-already-in-use`
  // antes do postSession). Mensagem clara > timeout opaco.
  if (loginResponse) {
    throw new Error(
      `[E2E] Login falhou (${loginResponse.status()}). Verifique TEST_USER_PASSWORD ou se o user existe no Firebase Auth.`,
    );
  }

  // loginResponse === null ⇒ TimeoutError no waitForResponse ⇒ request nunca
  // disparou (signInWithEmailAndPassword rejeitou client-side antes do
  // postSession) ⇒ user provavelmente não existe. Cai pro register.
  await page.goto("/register");
  await page.getByLabel("Nome completo").fill("MP Test User");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha").fill(password);

  const registerSessionWait = page.waitForResponse(
    (res) => res.url().includes("/api/auth/session") && res.request().method() === "POST",
    { timeout: 15_000 },
  );
  await page.getByRole("button", { name: "Criar conta" }).click();
  const registerResponse = await registerSessionWait;
  if (!registerResponse.ok()) {
    throw new Error(
      `[E2E] /api/auth/session falhou no register do test user (${registerResponse.status()}).`,
    );
  }
  const registerData = (await registerResponse.json()) as { uid?: string };
  if (!registerData.uid) {
    throw new Error("[E2E] /api/auth/session retornou sem uid (register).");
  }

  await expect(page).toHaveURL("/", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible({
    timeout: 10_000,
  });
  return registerData.uid;
}
