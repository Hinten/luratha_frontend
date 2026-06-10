import type { Metadata } from "next";
import { getSiteSettings } from "@luratha/repositories/siteSettingsRepository";
import { CompanyForm } from "./CompanyForm";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Dados da empresa",
};

export default async function EmpresaPage() {
  const settings = await getSiteSettings({ forceFresh: true });

  return (
    <div>
      <h1 className={styles.title}>Dados da empresa</h1>
      <p className={styles.lead}>
        Razão social, CNPJ, Encarregado de Dados (DPO) e foro. Esses dados alimentam as páginas de
        Política de Privacidade e Termos de Uso da loja. As alterações entram em vigor na loja em
        até 60 segundos (cache do servidor).
      </p>
      <CompanyForm initialCompany={settings.company} />
    </div>
  );
}
