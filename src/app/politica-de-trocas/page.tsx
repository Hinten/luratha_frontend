import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import JsonLd from "@/src/components/JsonLd";
import type { FAQPage, WithContext } from "schema-dts";

export const metadata: Metadata = {
  title: "Política de Trocas e Devoluções",
  description:
    "Saiba como funciona a política de trocas e devoluções da Luratha: prazos, condições, custos de envio e como solicitar a troca.",
  alternates: { canonical: "https://www.luratha.com.br/politica-de-trocas" },
  openGraph: {
    title: "Política de Trocas e Devoluções | Luratha",
    description:
      "Saiba como funciona a política de trocas e devoluções da Luratha: prazos, condições, custos de envio e como solicitar a troca.",
    url: "https://www.luratha.com.br/politica-de-trocas",
    type: "website",
  },
};

const faqSchema: WithContext<FAQPage> = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Qual o prazo para troca ou devolução?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Você tem até 7 dias corridos após o recebimento do pedido para solicitar a troca ou devolução, conforme previsto no Código de Defesa do Consumidor (Art. 49). Para produtos com defeito, o prazo é de 30 dias para produtos não duráveis e 90 dias para produtos duráveis.",
      },
    },
    {
      "@type": "Question",
      name: "Quais são as condições para efetuar a troca?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Para efetuar a troca, o produto deve estar em perfeitas condições: sem uso, com etiquetas originais, sem odores e na embalagem original. Produtos personalizados ou feitos sob medida não podem ser trocados, salvo em caso de defeito.",
      },
    },
    {
      "@type": "Question",
      name: "Como solicitar a troca de um produto Luratha?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Entre em contato pelo WhatsApp (12) 98278-9225 informando o número do pedido, o motivo da troca e, se possível, fotos do produto. Nossa equipe responderá em até 2 dias úteis com as instruções para envio.",
      },
    },
    {
      "@type": "Question",
      name: "Quem paga o frete da devolução?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Em caso de defeito ou erro da Luratha, o frete da devolução é por nossa conta. Para trocas por preferência (tamanho, cor), o frete de retorno é de responsabilidade do cliente. O envio da peça nova após a troca é gratuito.",
      },
    },
    {
      "@type": "Question",
      name: "Como funciona o reembolso?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Para devoluções, o reembolso é feito pelo mesmo meio de pagamento utilizado na compra, em até 10 dias úteis após o recebimento e análise do produto. Para cartão de crédito, o prazo pode variar conforme a operadora.",
      },
    },
  ],
};

const POLICY_SECTIONS = [
  {
    title: "Prazo para Troca ou Devolução",
    content:
      "Você tem até 7 dias corridos após o recebimento do pedido para solicitar a troca ou devolução, conforme previsto no Código de Defesa do Consumidor (Art. 49). Para produtos com defeito, o prazo é de 30 dias para produtos não duráveis e 90 dias para produtos duráveis.",
  },
  {
    title: "Condições para Troca",
    content:
      "Para efetuar a troca, o produto deve estar em perfeitas condições: sem uso, com etiquetas originais, sem odores e na embalagem original. Produtos personalizados ou feitos sob medida não podem ser trocados, salvo em caso de defeito.",
  },
  {
    title: "Como Solicitar a Troca",
    content:
      "Entre em contato pelo nosso WhatsApp ou e-mail informando o número do pedido, o motivo da troca e, se possível, fotos do produto. Nossa equipe responderá em até 2 dias úteis com as instruções para envio.",
  },
  {
    title: "Custos de Envio",
    content:
      "Em caso de defeito ou erro da Luratha, o frete da devolução é por nossa conta. Para trocas por preferência (tamanho, cor), o frete de retorno é de responsabilidade do cliente. O envio da peça nova após a troca é gratuito.",
  },
  {
    title: "Reembolso",
    content:
      "Para devoluções, o reembolso é feito pelo mesmo meio de pagamento utilizado na compra, em até 10 dias úteis após o recebimento e análise do produto. Para cartão de crédito, o prazo pode variar conforme a operadora.",
  },
  {
    title: "Produtos em Promoção",
    content:
      "Produtos adquiridos em promoção também podem ser trocados ou devolvidos nas mesmas condições descritas acima, desde que respeitados os prazos e condições gerais.",
  },
];

export default function PoliticaDeTrocasPage() {
  return (
    <div className="container-luratha section-padding">
      <JsonLd data={faqSchema} />
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className="mb-4">Política de Trocas e Devoluções</h1>
          <p className={styles.headerText}>
            Queremos que você ame cada peça. Saiba como funciona nosso processo
            de troca e devolução.
          </p>
        </div>

        {/* Content */}
        <div className={styles.sections}>
          {POLICY_SECTIONS.map(({ title, content }) => (
            <section key={title}>
              <h2 className={styles.sectionTitle}>{title}</h2>
              <p className={styles.sectionText}>{content}</p>
            </section>
          ))}
        </div>

        {/* Divider */}
        <div className={styles.divider} />

        {/* Contact note */}
        <div className={styles.contactNote}>
          <p className={styles.contactNoteText}>
            Tem alguma dúvida sobre a política de trocas?{" "}
            <Link href="/contato" className={styles.contactNoteLink}>
              Fale conosco
            </Link>{" "}
            e teremos prazer em ajudar.
          </p>
        </div>
      </div>
    </div>
  );
}


