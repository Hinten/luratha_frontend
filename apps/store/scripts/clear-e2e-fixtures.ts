/**
 * Limpa as fixtures de E2E (produtos + categorias deterministas) do projeto
 * de teste cloud (luratha-96386).
 *
 *   pnpm --filter @luratha/store clear-e2e-fixtures
 *
 * As lanes de E2E em CI rodam com `E2E_KEEP_FIXTURES=1` (teardown
 * não-destrutivo) pra não apagarem as fixtures umas das outras quando rodam em
 * paralelo — então as fixtures persistem entre runs. Como os IDs são fixos elas
 * são só re-semeadas (upsert idempotente), nunca acumulam; este script é a
 * alavanca manual pra zerá-las quando o conjunto de fixtures muda (IDs antigos
 * viram órfãos) ou pra forçar um slate limpo.
 *
 * Escreve no projeto Firebase do `.env` da raiz — o mesmo que o `pnpm dev` usa.
 * Requer credenciais Admin (FIREBASE_SERVICE_ACCOUNT_BASE64 / _PATH /
 * GOOGLE_APPLICATION_CREDENTIALS).
 */
import { loadRootEnv } from "@luratha/devtools/loadRootEnv";

async function main(): Promise<void> {
  // Carrega o .env da raiz ANTES de importar o módulo de seed, que puxa o
  // firebaseAdmin e inicializa o Admin SDK lendo as credenciais no import.
  loadRootEnv();
  const { clearE2eFixtures } = await import("../src/test/seedE2eCloudFirestore");
  await clearE2eFixtures();
  console.log("[clear-e2e-fixtures] Fixtures de E2E removidas do projeto de teste cloud.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
