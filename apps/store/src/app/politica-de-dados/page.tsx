import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import JsonLd from "@/src/components/JsonLd";
import CookiePreferences from "@/src/components/analytics/CookiePreferences";
import { SITE_URL, DEFAULT_OG_IMAGE, LURATHA_SCHEMA } from "@/src/lib/seoConstants";
import { getCachedSiteSettings } from "@/src/lib/queries/getCachedSiteSettings";
import type { CompanySettings } from "@luratha/schemas";

// SSR a cada request para refletir as edições de `company` feitas no admin
// (mesmo padrão da Política de Privacidade). O repositório mantém cache de 60s.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Política de Dados",
  description:
    "Como a Luratha usa cookies e o Google Analytics para medir o uso da loja, com que base legal, e como você pode recusar a coleta a qualquer momento (Consent Mode v2 / LGPD).",
  alternates: { canonical: `${SITE_URL}/politica-de-dados` },
  openGraph: {
    title: "Política de Dados | Luratha",
    description:
      "Cookies, Google Analytics e Consent Mode v2 na Luratha: o que medimos, por quê, e como recusar a coleta a qualquer momento.",
    url: `${SITE_URL}/politica-de-dados`,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

// Data de vigência desta versão. Atualize ao revisar o texto.
const LAST_UPDATED_LABEL = "9 de junho de 2026";
const LAST_UPDATED_ISO = "2026-06-09";

type Section = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

function orPlaceholder(value: string, placeholder: string): string {
  return value.trim().length > 0 ? value : placeholder;
}

/**
 * MINUTA — texto-base sobre tratamento de dados de navegação (cookies +
 * analytics). Os dados de identificação vêm de `siteSettings.company`,
 * editáveis no admin. Requer revisão jurídica antes da publicação definitiva.
 */
function buildSections(company: CompanySettings): Section[] {
  const contactEmail = orPlaceholder(company.contactEmail, "[INSERIR E-MAIL DE CONTATO]");
  const dpoName = orPlaceholder(company.dpoName, "[INSERIR NOME DO ENCARREGADO]");
  const dpoEmail = orPlaceholder(company.dpoEmail, "[INSERIR E-MAIL DO ENCARREGADO]");

  return [
    {
      title: "1. O que esta política cobre",
      paragraphs: [
        "Esta Política de Dados explica como usamos cookies e ferramentas de medição para entender como você navega na loja. Ela complementa a nossa Política de Privacidade, que trata dos dados pessoais ligados às suas compras e ao seu cadastro.",
      ],
    },
    {
      title: "2. Cookies e tecnologias que usamos",
      items: [
        "Cookies essenciais: mantêm sua sessão, o login e o carrinho. Sem eles a loja não funciona; por isso não dependem de consentimento.",
        "Cookies de análise e anúncios: usamos o Google Analytics 4 para medir páginas visitadas, origem do tráfego e o desempenho do funil de compra, e para mensurar campanhas.",
      ],
    },
    {
      title: "3. Google Analytics e Consent Mode v2",
      paragraphs: [
        "A medição é feita pelo Google Analytics 4 com o Consent Mode v2 do Google. Operamos no modelo opt-out: a medição vem ativa por padrão e você pode recusá-la a qualquer momento usando o controle abaixo. Ao recusar, ajustamos imediatamente os sinais de consentimento (analytics_storage, ad_storage, ad_user_data e ad_personalization) para o estado negado, e a sua escolha fica salva neste navegador.",
      ],
    },
    {
      title: "4. Base legal e seus direitos",
      paragraphs: [
        "Tratamos os dados de navegação com base no legítimo interesse de entender e melhorar a loja, sempre oferecendo a você a opção de recusar (art. 7º, IX e art. 18 da LGPD). Você pode revisar ou alterar a sua escolha quando quiser nesta página, e exercer os demais direitos previstos na nossa Política de Privacidade.",
      ],
    },
    {
      title: "5. Falar com o Encarregado de Dados (DPO)",
      paragraphs: [
        `Para dúvidas sobre o tratamento dos seus dados, fale com o nosso Encarregado: ${dpoName} — ${dpoEmail}. Você também pode nos escrever em ${contactEmail}.`,
      ],
    },
  ];
}

export default async function PoliticaDeDadosPage() {
  const { company } = await getCachedSiteSettings();
  const sections = buildSections(company);

  const schema = {
    "@context": "https://schema.org" as const,
    "@type": "WebPage",
    name: "Política de Dados",
    description:
      "Como a Luratha usa cookies e o Google Analytics para medir o uso da loja, com que base legal, e como recusar a coleta (Consent Mode v2 / LGPD).",
    url: `${SITE_URL}/politica-de-dados`,
    inLanguage: "pt-BR",
    dateModified: LAST_UPDATED_ISO,
    isPartOf: { "@type": "WebSite", name: "Luratha", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: orPlaceholder(company.legalName, LURATHA_SCHEMA.name),
      url: SITE_URL,
    },
  };

  return (
    <div className="container-luratha section-padding">
      <JsonLd data={schema} />
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className="mb-4">Política de Dados</h1>
          <p className={styles.headerText}>
            Transparência sobre cookies e medição. Saiba o que coletamos para entender o uso da loja
            — e recuse quando quiser.
          </p>
          <p className={styles.updatedAt}>
            Última atualização: <time dateTime={LAST_UPDATED_ISO}>{LAST_UPDATED_LABEL}</time>
          </p>
        </div>

        <section className={styles.preferences} aria-label="Suas preferências de cookies">
          <h2 className={styles.sectionTitle}>Suas preferências</h2>
          <CookiePreferences />
        </section>

        <div className={styles.sections}>
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              {section.paragraphs?.map((text, i) => (
                <p key={i} className={styles.sectionText}>
                  {text}
                </p>
              ))}
              {section.items && (
                <ul className={styles.list}>
                  {section.items.map((item) => (
                    <li key={item} className={styles.listItem}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.contactNote}>
          <p className={styles.contactNoteText}>
            Quer entender como tratamos os dados das suas compras?{" "}
            <Link href={"/politica-de-privacidade" as Route} className={styles.contactNoteLink}>
              Leia a Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
