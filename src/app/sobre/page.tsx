import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import JsonLd from "@/src/components/JsonLd";
import type { AboutPage, WithContext } from "schema-dts";

export const metadata: Metadata = {
  title: "Nossa História",
  description:
    "Conheça a Luratha — marca brasileira de moda feminina artesanal comprometida com beleza intencional, slow fashion e consumo consciente.",
  alternates: { canonical: "https://www.luratha.com.br/sobre" },
  openGraph: {
    title: "Nossa História | Luratha",
    description:
      "Conheça a Luratha — marca brasileira de moda feminina artesanal comprometida com beleza intencional, slow fashion e consumo consciente.",
    url: "https://www.luratha.com.br/sobre",
    type: "website",
  },
};

const aboutPageSchema: WithContext<AboutPage> = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "Nossa História – Luratha",
  description:
    "A Luratha nasceu do amor por peças que duram e contam histórias. Somos uma marca de moda feminina artesanal brasileira, comprometida com a beleza intencional e o consumo consciente.",
  url: "https://www.luratha.com.br/sobre",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: "https://www.luratha.com.br" },
      { "@type": "ListItem", position: 2, name: "Sobre", item: "https://www.luratha.com.br/sobre" },
    ],
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

