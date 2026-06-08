import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, DEFAULT_OG_IMAGE } from "@/src/lib/seoConstants";

export const metadata: Metadata = {
  title: "Perguntas Frequentes (FAQ)",
  description:
    "Tire suas dúvidas sobre a Luratha: formas de pagamento, frete e prazos, trocas e devoluções, tamanhos e cuidados com as peças artesanais.",
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: "Perguntas Frequentes (FAQ) | Luratha",
    description:
      "Pagamento, frete, prazos, trocas, tamanhos e cuidados com as peças — respostas rápidas para suas dúvidas.",
    url: `${SITE_URL}/faq`,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

type Faq = {
  question: string;
  answer: string;
  links?: { href: Route; label: string }[];
};

// Rascunho inicial derivado do funcionamento atual da loja (pagamento via
// MercadoPago, frete por CEP, trocas em 7 dias). Revise conforme a operação.
const FAQS: Faq[] = [
  {
    question: "Quais formas de pagamento vocês aceitam?",
    answer:
      "Aceitamos PIX, cartão de crédito (à vista ou parcelado) e boleto bancário. Os pagamentos são processados com segurança pelo MercadoPago.",
  },
  {
    question: "Posso parcelar minha compra?",
    answer:
      "Sim. No cartão de crédito você pode parcelar; as opções e o número de parcelas disponíveis aparecem na finalização do pedido.",
  },
  {
    question: "Como calculo o frete e o prazo de entrega?",
    answer:
      "Informe o seu CEP na página do produto ou no carrinho para ver o valor e o prazo estimado. O cálculo é feito por transportadoras parceiras conforme a sua região.",
    links: [{ href: "/entrega", label: "Saiba mais sobre Entrega" }],
  },
  {
    question: "Vocês oferecem frete grátis?",
    answer:
      "Sim, oferecemos frete grátis para compras acima de um determinado valor. A elegibilidade é calculada por região e aparece automaticamente no carrinho e no checkout.",
  },
  {
    question: "Como acompanho meu pedido?",
    answer:
      "Você acompanha o status em Minha Conta, na seção Meus Pedidos. Assim que o pedido é despachado, o código de rastreamento fica disponível ali.",
  },
  {
    question: "Posso trocar ou devolver uma peça?",
    answer:
      "Sim. Você tem até 7 dias corridos após o recebimento para solicitar troca ou devolução, conforme o Código de Defesa do Consumidor (art. 49).",
    links: [{ href: "/politica-de-trocas", label: "Política de Trocas" }],
  },
  {
    question: "Como sei qual tamanho escolher?",
    answer:
      "Temos um guia completo de medidas (do PP ao XGG) com as referências de busto, cintura e quadril para você escolher com confiança.",
    links: [{ href: "/referencia-de-medidas", label: "Referência de Medidas" }],
  },
  {
    question: "Como devo cuidar das peças?",
    answer:
      "Nossas peças são slow fashion, feitas para durar. Siga sempre as instruções da etiqueta: prefira lavagem suave, evite alvejantes e secagem em máquina para preservar tecidos e bordados.",
  },
  {
    question: "As peças são realmente feitas à mão?",
    answer:
      "Sim. Cada peça é artesanal, produzida em pequenas quantidades. Pequenas variações são naturais e fazem parte do caráter único de cada item.",
  },
  {
    question: "Como entro em contato com a Luratha?",
    answer:
      "Fale com a gente pelo WhatsApp, telefone ou pelo formulário da página de contato. Respondemos o mais rápido possível.",
    links: [{ href: "/contato", label: "Fale Conosco" }],
  },
];

const faqSchema = {
  "@context": "https://schema.org" as const,
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <div className="container-luratha section-padding">
      <JsonLd data={faqSchema} />
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className="mb-4">Perguntas Frequentes</h1>
          <p className={styles.headerText}>
            Reunimos as dúvidas mais comuns sobre compras, pagamento, entrega e cuidados com as
            peças. Não achou o que procurava? Fale conosco.
          </p>
        </div>

        <div className={styles.sections}>
          {FAQS.map((faq) => (
            <section key={faq.question}>
              <h2 className={styles.sectionTitle}>{faq.question}</h2>
              <p className={styles.sectionText}>{faq.answer}</p>
              {faq.links && (
                <p className={styles.sectionText}>
                  {faq.links.map((link, i) => (
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
            Ainda tem dúvidas?{" "}
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
