import type { Metadata } from "next";
import { getSiteSettings } from "@luratha/repositories/siteSettingsRepository";
import { GoogleAnalyticsForm } from "./GoogleAnalyticsForm";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Google Analytics",
};

export default async function GoogleAnalyticsPage() {
  const settings = await getSiteSettings({ forceFresh: true });

  return (
    <div>
      <h1 className={styles.title}>Google Analytics</h1>
      <p className={styles.lead}>
        Conecte o Google Analytics 4 informando o Measurement ID (formato <code>G-XXXXXXXX</code>).
        Quando preenchido e ativo, a loja passa a medir o tráfego e os eventos de e-commerce
        (visualização de produto, carrinho, checkout e compra), respeitando o consentimento do
        visitante (Consent Mode v2, modelo opt-out). As alterações entram em vigor na loja em até 60
        segundos.
      </p>
      <GoogleAnalyticsForm initialGoogle={settings.google} />
    </div>
  );
}
