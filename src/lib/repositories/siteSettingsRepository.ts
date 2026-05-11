import "server-only";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminSiteSettingsConverter } from "@/src/lib/firestore/adminSiteSettingsConverter";
import {
  firestoreCollections,
  getDefaultSiteSettings,
  SITE_SETTINGS_DOC_ID,
  type SiteSettings,
  validateSiteSettings,
} from "@/src/schemas/firestore";

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
  if (!options.forceFresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.value;
  }

  const snapshot = await settingsDocRef().get();
  const value = snapshot.exists ? snapshot.data()! : getDefaultSiteSettings();
  cache = { value, fetchedAt: Date.now() };
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
