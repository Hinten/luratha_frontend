import { expect, type Page } from "@playwright/test";

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
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL("/", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible({
    timeout: 10_000,
  });

  // Captura o uid via API — o body do /api/auth/me valida o cookie __session
  // e devolve { uid, ... }. Sem isso o spec não consegue mockar
  // `/api/users/{uid}/...` nem chamar seedFixtureCart(uid).
  const uid = await page.evaluate(async () => {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { uid?: string };
    return data.uid ?? null;
  });
  if (!uid) {
    throw new Error("[E2E] Não foi possível recuperar o uid após register.");
  }
  return uid;
}
