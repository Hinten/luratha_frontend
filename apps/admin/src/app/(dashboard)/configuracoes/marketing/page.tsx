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
        Google Merchant Center e Google Analytics 4. O <strong>GA4 já é medido na loja</strong>{" "}
        (Consent Mode v2, modo opt-out) a partir do Measurement ID abaixo; os demais IDs alimentam o
        feed de produtos e o rastreamento de anúncios em fases seguintes. As alterações entram em
        vigor na loja em até 60 segundos.
      </p>
      <MarketingForm initialMarketing={settings.marketing} />
    </div>
  );
}
