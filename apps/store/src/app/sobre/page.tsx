import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, LURATHA_SCHEMA, DEFAULT_OG_IMAGE } from "@/src/lib/seoConstants";

export const metadata: Metadata = {
  title: "Sobre a Luratha",
  description:
    "Conheça a história, os valores e o manifesto da Luratha — marca brasileira de slow fashion artesanal feminino comprometida com a moda consciente.",
  alternates: { canonical: `${SITE_URL}/sobre` },
  openGraph: {
    title: "Sobre a Luratha",
    description:
      "Conheça a história, os valores e o manifesto da Luratha — marca brasileira de slow fashion artesanal feminino.",
    url: `${SITE_URL}/sobre`,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

const aboutPageSchema = {
  "@context": "https://schema.org" as const,
  "@type": "AboutPage",
  name: "Sobre a Luratha",
  description:
    "Conheça a história, os valores e o manifesto da Luratha — marca brasileira de slow fashion artesanal feminino.",
  url: `${SITE_URL}/sobre`,
  isPartOf: {
    "@type": "WebSite",
    name: LURATHA_SCHEMA.name,
    url: LURATHA_SCHEMA.url,
  },
};

const organizationSchema = {
  "@context": "https://schema.org" as const,
  "@type": "Organization",
  name: LURATHA_SCHEMA.name,
  url: LURATHA_SCHEMA.url,
  logo: LURATHA_SCHEMA.logo,
  telephone: LURATHA_SCHEMA.telephone,
  sameAs: LURATHA_SCHEMA.sameAs,
  description:
    "Luratha é uma marca brasileira de moda feminina artesanal — slow fashion com foco em peças versáteis, sustentáveis e feitas com amor para durar.",
  foundingLocation: {
    "@type": "Country",
    name: "Brasil",
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "BR",
  },
};

const VALUES = [
  {
    title: "Artesanal",
    description:
      "Cada peça é criada com cuidado e atenção aos detalhes. Valorizamos as mãos que costuram, os tecidos que respiram e a história por trás de cada ponto.",
  },
  {
    title: "Versátil",
    description:
      "Desenvolvemos roupas que se adaptam à vida real — do dia a dia ao momento especial. Uma peça, várias histórias.",
  },
  {
    title: "Sustentável",
    description:
      "Acreditamos em um consumo mais consciente. Por isso, produzimos em pequenas coleções, priorizando materiais responsáveis e processos éticos.",
  },
];

export default function SobrePage() {
  return (
    <div className="container-luratha section-padding">
      <JsonLd data={aboutPageSchema} />
      <JsonLd data={organizationSchema} />
      {/* Hero */}
      <div className={styles.hero}>
        <h1 className="mb-6">Nossa História</h1>
        <p className={styles.heroText}>
          A Luratha nasceu do amor por peças que duram e contam histórias. Somos
          uma marca de moda feminina artesanal brasileira, comprometida com a
          beleza intencional e o consumo consciente.
        </p>
      </div>

      {/* Values */}
      <div className={styles.valuesGrid}>
        {VALUES.map(({ title, description }) => (
          <div key={title} className={styles.valueCard}>
            <h3>{title}</h3>
            <p className={styles.valueCardText}>{description}</p>
          </div>
        ))}
      </div>

      {/* Manifesto */}
      <div className={styles.manifesto}>
        <h2 className="mb-6">Nosso Manifesto</h2>
        <p className={styles.manifestoText}>
          Acreditamos que a moda pode ser um ato de amor — amor a si mesma, ao
          trabalho artesanal e ao planeta. Na Luratha, cada peça é pensada para
          ser especial no dia em que você a usa e anos depois.
        </p>
        <p className={styles.manifestoTextLast}>
          Fazemos slow fashion de verdade: menos coleções, mais significado.
          Somos feitas no Brasil, com orgulho e com carinho.
        </p>
      </div>

      {/* CTA */}
      <div className={styles.cta}>
        <Link href="/contato" className={styles.ctaBtn}>
          Fale conosco
        </Link>
      </div>
    </div>
  );
}

