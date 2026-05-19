import "server-only";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminSiteSettingsConverter } from "@luratha/firestore/adminSiteSettingsConverter";
import {
  firestoreCollections,
  getDefaultSiteSettings,
  SITE_SETTINGS_DOC_ID,
  type SiteSettings,
  validateSiteSettings,
} from "@luratha/schemas";

/**
 * Lê o documento global de configuração. Quando ainda não existe (instância
 * nova, dev local sem seed), devolve `getDefaultSiteSettings()` sem persistir.
 * Cabe a um seed/admin UI futuro materializar o documento.
 *
 * Cache em memória de 60s para evitar leitura por requisição em cold paths
 * (cálculo de frete acontece em vários pontos: PDP, cart, checkout).
 */

type CacheEntry = { value: SiteSettings; fetchedAt: number };
const CACHE_TTL_MS = 60_000;
let cache: CacheEntry | null = null;

function settingsDocRef() {
  return adminDb
    .collection(firestoreCollections.settings)
    .doc(SITE_SETTINGS_DOC_ID)
    .withConverter(adminSiteSettingsConverter);
}

export async function getSiteSettings(options: { forceFresh?: boolean } = {}): Promise<SiteSettings> {
  console.debug("Buscando site settings...");
  if (!options.forceFresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    console.debug("Usando site settings do cache.", cache.value);
    return cache.value;
  }

  const snapshot = await settingsDocRef().get();
  const value = snapshot.exists ? snapshot.data()! : getDefaultSiteSettings();
  cache = { value, fetchedAt: Date.now() };
  console.debug("Site settings atualizados.", value);
  return value;
}

/**
 * Persiste o documento global. Sobrescreve por completo — os PATCHes do admin
 * devem ler com `getSiteSettings({ forceFresh: true })`, mesclar e chamar aqui.
 */
export async function setSiteSettings(input: unknown): Promise<SiteSettings> {
  const validated = validateSiteSettings({
    ...(typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {}),
    id: SITE_SETTINGS_DOC_ID,
    updatedAt: new Date().toISOString(),
  });
  await settingsDocRef().set(validated);
  cache = { value: validated, fetchedAt: Date.now() };
  return validated;
}

/** Limpa o cache em memória. Útil em testes. */
export function clearSiteSettingsCache(): void {
  cache = null;
}
