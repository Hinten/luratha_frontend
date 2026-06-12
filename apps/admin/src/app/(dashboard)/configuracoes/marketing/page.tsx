import type { Metadata } from "next";
import { getSiteSettings } from "@luratha/repositories/siteSettingsRepository";
import { MarketingForm } from "./MarketingForm";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Marketing & Pixels",
};

export default async function MarketingPage() {
  const settings = await getSiteSettings({ forceFresh: true });

  return (
    <div>
      <h1 className={styles.title}>Marketing &amp; Pixels</h1>
      <p className={styles.lead}>
        Identificadores das plataformas de anúncio e analytics: Meta Pixel, Catálogo do Facebook,
        Google Merchant Center e Google Analytics 4. Por enquanto esses dados são apenas armazenados
        — o feed de produtos e os scripts de rastreamento são configurados em fases seguintes.
      </p>
      <MarketingForm initialMarketing={settings.marketing} />
    </div>
  );
}
