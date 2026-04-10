import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, DEFAULT_OG_IMAGE } from "@/src/lib/seoConstants";

export const metadata: Metadata = {
  title: "Referência de Medidas",
  description:
    "Guia completo de tamanhos Luratha do PP ao XGG. Encontre seu tamanho ideal com a tabela de medidas de busto, cintura e quadril em centímetros.",
  alternates: { canonical: `${SITE_URL}/referencia-de-medidas` },
  openGraph: {
    title: "Referência de Medidas | Luratha",
    description:
      "Guia completo de tamanhos Luratha do PP ao XGG. Encontre seu tamanho ideal com a tabela de medidas.",
    url: `${SITE_URL}/referencia-de-medidas`,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

const SIZE_CHART = [
  { size: "PP", bust: "80–84", waist: "62–66", hip: "88–92" },
  { size: "P", bust: "84–88", waist: "66–70", hip: "92–96" },
  { size: "M", bust: "88–92", waist: "70–74", hip: "96–100" },
  { size: "G", bust: "92–96", waist: "74–78", hip: "100–104" },
  { size: "GG", bust: "96–100", waist: "78–82", hip: "104–108" },
  { size: "XGG", bust: "100–108", waist: "82–90", hip: "108–116" },
];

const MEASURE_TIPS = [
  {
    label: "Busto",
    tip: "Meça ao redor da parte mais larga do busto, com os braços relaxados ao lado do corpo.",
  },
  {
    label: "Cintura",
    tip: "Meça ao redor da parte mais estreita da cintura, geralmente 2–3 cm acima do umbigo.",
  },
  {
    label: "Quadril",
    tip: "Meça ao redor da parte mais larga do quadril, geralmente 18–20 cm abaixo da cintura.",
  },
];

const faqSchema = {
  "@context": "https://schema.org" as const,
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Como medir o busto corretamente?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Meça ao redor da parte mais larga do busto, com os braços relaxados ao lado do corpo.",
      },
    },
    {
      "@type": "Question",
      name: "Como medir a cintura corretamente?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Meça ao redor da parte mais estreita da cintura, geralmente 2–3 cm acima do umbigo.",
      },
    },
    {
      "@type": "Question",
      name: "Como medir o quadril corretamente?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Meça ao redor da parte mais larga do quadril, geralmente 18–20 cm abaixo da cintura.",
      },
    },
    {
      "@type": "Question",
      name: "Quais tamanhos a Luratha oferece?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A Luratha oferece os tamanhos PP, P, M, G, GG e XGG. Em caso de dúvida entre dois tamanhos, recomendamos escolher o maior.",
      },
    },
  ],
};

export default function ReferenciaDeMedidasPage() {
  return (
    <div className="container-luratha section-padding">
      <JsonLd data={faqSchema} />
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className="mb-4">Referência de Medidas</h1>
          <p className={styles.headerText}>
            Encontre o seu tamanho ideal. Todas as medidas estão em
            centímetros.
          </p>
        </div>

        {/* How to measure */}
        <div className={styles.tipsCard}>
          <h2 className={styles.tipsHeading}>Como medir corretamente</h2>
          <ul className={styles.tipsList}>
            {MEASURE_TIPS.map(({ label, tip }) => (
              <li key={label} className={styles.tipItem}>
                <span className={styles.tipLabel}>{label}:</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Size chart table */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th}>Tamanho</th>
                <th className={styles.th}>Busto (cm)</th>
                <th className={styles.th}>Cintura (cm)</th>
                <th className={styles.th}>Quadril (cm)</th>
              </tr>
            </thead>
            <tbody>
              {SIZE_CHART.map(({ size, bust, waist, hip }, i) => (
                <tr key={size} className={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td className={styles.tdBold}>{size}</td>
                  <td className={styles.td}>{bust}</td>
                  <td className={styles.td}>{waist}</td>
                  <td className={styles.td}>{hip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tip note */}
        <p className={styles.footerNote}>
          Em caso de dúvida entre dois tamanhos, recomendamos escolher o maior.
          Se precisar de ajuda,{" "}
          <Link href="/contato" className={styles.footerNoteLink}>
            fale conosco
          </Link>
          .
        </p>
      </div>
    </div>
  );
}


