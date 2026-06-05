import type { Metadata } from "next";
import { getSiteSettings } from "@luratha/repositories/siteSettingsRepository";
import { fetchMelhorEnvioServices } from "@/src/lib/melhorEnvioServices";
import { SettingsForm } from "./SettingsForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Configurações",
};

export default async function ConfiguracoesPage() {
  const [settings, availableServices] = await Promise.all([
    getSiteSettings({ forceFresh: true }),
    fetchMelhorEnvioServices(),
  ]);

  return (
    <div>
      <h1 className={styles.title}>Configurações do site</h1>
      <p className={styles.lead}>
        Provider de frete, frete grátis e tabela de tarifas. As alterações entram em vigor na loja
        em até 60 segundos (cache do servidor).
      </p>
      <SettingsForm initialShipping={settings.shipping} availableServices={availableServices} />
    </div>
  );
}
