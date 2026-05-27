import { expect, type Page } from "@playwright/test";

/**
 * Faz sign-in do user fixture (criado pelo `playwrightCloudSetup.globalSetup.ts`)
 * via UI do `/login`. Sem fazer login via UI, o `AuthContext` (que escuta
 * `onIdTokenChanged` do Firebase client SDK) não popula `user`, e o
 * `CheckoutPage` redireciona pro /login — mesmo com o cookie `__session`
 * presente. Setar só o cookie cobre o proxy mas não o gate client-side.
 *
 * Espera `E2E_FIXTURE_EMAIL` e `E2E_FIXTURE_PASSWORD` no env (setados pelo
 * globalSetup).
 */
export async function signInAsFixture(page: Page): Promise<void> {
  const email = process.env.E2E_FIXTURE_EMAIL;
  const password = process.env.E2E_FIXTURE_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "[E2E] E2E_FIXTURE_EMAIL/PASSWORD ausentes — globalSetup não rodou.",
    );
  }

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Padrão canônico do auth.spec.ts: aguarda o redirect para `/` e o header
  // re-renderizar com o user logado (botão "Sair da conta" aparece) — só aí o
  // AuthContext já populou `user` via onIdTokenChanged + postSession.
  await expect(page).toHaveURL("/", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible({
    timeout: 10_000,
  });
}
