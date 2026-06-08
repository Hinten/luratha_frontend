import "server-only";
import { cache } from "react";
import { getSiteSettings } from "@luratha/repositories/siteSettingsRepository";
import type { SiteSettings } from "@luratha/schemas";

/**
 * Reads the global site settings document, deduplicated per React render via
 * `cache()`. Safe to call from `generateMetadata` and the page body in the same
 * request without an extra Firestore round-trip (the repository also keeps a
 * 60s in-memory cache across requests).
 *
 * Used by the institutional pages to surface the configurable company
 * identification block (`company`) — legal name, CNPJ, DPO, jurisdiction.
 */
export const getCachedSiteSettings = cache((): Promise<SiteSettings> => getSiteSettings());
