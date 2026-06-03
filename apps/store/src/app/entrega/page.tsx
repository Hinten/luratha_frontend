import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, DEFAULT_OG_IMAGE } from "@/src/lib/seoConstants";

export const metadata: Metadata = {
  title: "Entrega e Frete",
  description:
    "Como funciona a entrega na Luratha: cálculo de frete por CEP, prazos por região, transportadoras parceiras, frete grátis e rastreamento do pedido.",
  alternates: { canonical: `${SITE_URL}/entrega` },
  openGraph: {
    title: "Entrega e Frete | Luratha",
    description:
      "Cálculo de frete por CEP, prazos por região, transportadoras, frete grátis e rastreamento do seu pedido.",
    url: `${SITE_URL}/entrega`,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

type DeliveryTopic = {
  question: string;
  answer: string;
  links?: { href: Route; label: string }[];
};

// Rascunho inicial derivado do funcionamento atual (frete por CEP via
// transportadoras parceiras). Ajuste prazos e regras conforme a operação.
const TOPICS: DeliveryTopic[] = [
  {
    question: "Como o frete é calculado?",
    answer:
      "O frete é calculado pelo seu CEP. Basta informá-lo na página do produto ou no carrinho para ver as opções de envio, com valor e prazo estimado para o seu endereço.",
  },
  {
    question: "Quais são os prazos de entrega?",
    answer:
      "O prazo varia conforme a região de destino e a modalidade de envio escolhida. O prazo estimado é sempre exibido no momento do cálculo do frete, antes de você finalizar a compra. Esse prazo passa a contar a partir da confirmação do pagamento e da postagem.",
  },
  {
    question: "Quais transportadoras vocês utilizam?",
    answer:
      "Trabalhamos com os Correios (PAC e SEDEX) e outras transportadoras parceiras integradas via Melhor Envio. A opção disponível para o seu pedido aparece automaticamente no cálculo do frete.",
  },
  {
    question: "Quanto custa o frete? Existe frete grátis?",
    answer:
      "O custo depende do destino, do peso e das dimensões das peças. Oferecemos frete grátis para compras acima de um determinado valor — quando o seu pedido se qualifica, a gratuidade aparece automaticamente no carrinho e no checkout.",
  },
  {
    question: "Em quanto tempo meu pedido é postado?",
    answer:
      "Após a confirmação do pagamento, preparamos o seu pedido com cuidado e o despachamos dentro do prazo de processamento informado. Por serem peças artesanais, esse preparo é feito com atenção a cada detalhe.",
  },
  {
    question: "Como rastreio meu pedido?",
    answer:
      "Assim que o pedido é enviado, o código de rastreamento fica disponível em Minha Conta, na seção Meus Pedidos, para você acompanhar a entrega.",
  },
  {
    question: "Vocês entregam em todo o Brasil?",
    answer:
      "Sim, entregamos em todo o território nacional. Basta informar o seu CEP para conferir as opções de envio disponíveis para a sua localidade.",
  },
  {
    question: "E se a entrega não der certo?",
    answer:
      "Caso a transportadora não consiga concluir a entrega, novas tentativas ou a retirada em uma unidade podem ser realizadas conforme as regras do serviço. Em caso de dúvida ou problema, fale com o nosso atendimento.",
    links: [{ href: "/contato", label: "Fale Conosco" }],
  },
];

const faqSchema = {
  "@context": "https://schema.org" as const,
  "@type": "FAQPage",
  mainEntity: TOPICS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

export default function EntregaPage() {
  return (
    <div className="container-luratha section-padding">
      <JsonLd data={faqSchema} />
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className="mb-4">Entrega e Frete</h1>
          <p className={styles.headerText}>
            Tudo sobre como o frete é calculado, os prazos, as transportadoras e
            o rastreamento do seu pedido.
          </p>
        </div>

        <div className={styles.sections}>
          {TOPICS.map((topic) => (
            <section key={topic.question}>
              <h2 className={styles.sectionTitle}>{topic.question}</h2>
              <p className={styles.sectionText}>{topic.answer}</p>
              {topic.links && (
                <p className={styles.sectionText}>
                  {topic.links.map((link, i) => (
                    <span key={link.href}>
                      {i > 0 ? " · " : ""}
                      <Link href={link.href} className={styles.inlineLink}>
                        {link.label}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </section>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.contactNote}>
          <p className={styles.contactNoteText}>
            Quer trocar uma peça depois da entrega? Veja a{" "}
            <Link href="/politica-de-trocas" className={styles.contactNoteLink}>
              Política de Trocas
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
