import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import styles from "./page.module.css";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, DEFAULT_OG_IMAGE, LURATHA_SCHEMA } from "@/src/lib/seoConstants";
import { getCachedSiteSettings } from "@/src/lib/queries/getCachedSiteSettings";
import type { CompanySettings } from "@luratha/schemas";

// SSR a cada request para refletir as edições de `company` feitas no admin. O
// repositório mantém um cache de 60s, então a leitura do Firestore ocorre no
// máximo a cada 60s; sem isto a página seria prerenderizada e os dados só
// mudariam a cada deploy.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Termos e condições de uso da loja Luratha: cadastro, compras, pagamento, entrega, trocas e responsabilidades. Leia antes de finalizar seu pedido.",
  alternates: { canonical: `${SITE_URL}/termos-de-uso` },
  openGraph: {
    title: "Termos de Uso | Luratha",
    description:
      "Condições de uso da loja Luratha: cadastro, compras, pagamento, entrega, trocas e foro.",
    url: `${SITE_URL}/termos-de-uso`,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

// Data de vigência desta versão. Atualize ao revisar o texto.
const LAST_UPDATED_LABEL = "3 de junho de 2026";
const LAST_UPDATED_ISO = "2026-06-03";

type Section = {
  title: string;
  paragraphs?: string[];
  links?: { href: Route; label: string }[];
};

function orPlaceholder(value: string, placeholder: string): string {
  return value.trim().length > 0 ? value : placeholder;
}

/**
 * MINUTA — texto-base dos Termos de Uso (CDC). Os dados de identificação e o
 * foro vêm de `siteSettings.company`, editáveis no admin
 * (/configuracoes/empresa). Requer revisão jurídica antes da publicação.
 */
function buildSections(company: CompanySettings): Section[] {
  const legalName = orPlaceholder(company.legalName, "[INSERIR RAZÃO SOCIAL]");
  const cnpj = orPlaceholder(company.cnpj, "[INSERIR CNPJ]");
  const jurisdiction = orPlaceholder(company.jurisdiction, "[INSERIR COMARCA/FORO]");

  return [
    {
      title: "1. Aceitação dos termos",
      paragraphs: [
        "Ao acessar e utilizar a loja Luratha (luratha.com.br) e ao finalizar uma compra, você declara ter lido, compreendido e concordado com estes Termos de Uso. Caso não concorde, recomendamos que não utilize o site.",
      ],
    },
    {
      title: "2. Identificação da loja",
      paragraphs: [
        `Esta loja é operada por ${legalName}, inscrita no CNPJ ${cnpj}, doravante denominada "Luratha".`,
      ],
    },
    {
      title: "3. Cadastro e conta",
      paragraphs: [
        "Para comprar, você pode precisar criar uma conta com informações verdadeiras, completas e atualizadas. Você é responsável por manter a confidencialidade da sua senha e por todas as atividades realizadas na sua conta. O cadastro é destinado a pessoas maiores de 18 anos ou devidamente representadas.",
      ],
    },
    {
      title: "4. Produtos, preços e disponibilidade",
      paragraphs: [
        "Por se tratar de slow fashion artesanal, as peças são produzidas em pequenas quantidades e estão sujeitas à disponibilidade de estoque. Imagens são ilustrativas e podem ter pequenas variações de cor conforme o dispositivo. Preços e condições podem ser alterados sem aviso prévio; o valor válido é o exibido no momento da finalização do pedido. Em caso de erro evidente de preço, a Luratha poderá cancelar o pedido e restituir eventual valor pago.",
      ],
    },
    {
      title: "5. Pagamento",
      paragraphs: [
        "Os pagamentos são processados pelo MercadoPago, com as opções de PIX, cartão de crédito (à vista ou parcelado) e boleto bancário. O pedido é confirmado após a aprovação do pagamento pela instituição financeira. A Luratha não armazena os dados completos do seu cartão.",
      ],
    },
    {
      title: "6. Entrega",
      paragraphs: [
        "O frete é calculado pelo CEP no checkout e a entrega é realizada por transportadoras parceiras. Prazos e custos variam conforme a região e a modalidade escolhida. Consulte os detalhes na página de Entrega.",
      ],
      links: [{ href: "/entrega", label: "Entrega e Frete" }],
    },
    {
      title: "7. Trocas e devoluções",
      paragraphs: [
        "Você pode solicitar troca ou devolução em até 7 dias corridos após o recebimento, conforme o direito de arrependimento previsto no art. 49 do Código de Defesa do Consumidor. As condições completas estão na nossa Política de Trocas.",
      ],
      links: [{ href: "/politica-de-trocas", label: "Política de Trocas" }],
    },
    {
      title: "8. Propriedade intelectual",
      paragraphs: [
        "Todo o conteúdo do site — marca, logotipo, textos, fotos, ilustrações e layout — pertence à Luratha ou a seus licenciadores e é protegido por lei. É vedada a reprodução, distribuição ou uso comercial sem autorização prévia e por escrito.",
      ],
    },
    {
      title: "9. Conduta do usuário",
      paragraphs: [
        "Você concorda em utilizar o site de forma lícita, sem violar direitos de terceiros, sem tentar acessar áreas restritas, sem inserir conteúdo ofensivo em avaliações e sem comprometer a segurança ou o funcionamento da plataforma.",
      ],
    },
    {
      title: "10. Limitação de responsabilidade",
      paragraphs: [
        "A Luratha empenha-se para manter o site disponível e as informações corretas, mas não se responsabiliza por indisponibilidades temporárias, falhas de terceiros (meios de pagamento, transportadoras) ou por danos decorrentes do uso indevido da plataforma. Nada nestes termos exclui direitos garantidos ao consumidor pela legislação aplicável.",
      ],
    },
    {
      title: "11. Privacidade",
      paragraphs: [
        "O tratamento dos seus dados pessoais é regido pela nossa Política de Privacidade, parte integrante destes Termos.",
      ],
      links: [{ href: "/politica-de-privacidade", label: "Política de Privacidade" }],
    },
    {
      title: "12. Alterações destes termos",
      paragraphs: [
        "A Luratha pode atualizar estes Termos de Uso a qualquer momento. A versão vigente é sempre a publicada nesta página, com a data de atualização indicada acima.",
      ],
    },
    {
      title: "13. Lei aplicável e foro",
      paragraphs: [
        `Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca de ${jurisdiction} para dirimir quaisquer controvérsias, sem prejuízo do foro do domicílio do consumidor, nos termos da lei.`,
      ],
    },
  ];
}

export default async function TermosDeUsoPage() {
  const { company } = await getCachedSiteSettings();
  const sections = buildSections(company);

  const schema = {
    "@context": "https://schema.org" as const,
    "@type": "WebPage",
    name: "Termos de Uso",
    description:
      "Termos e condições de uso da loja Luratha: cadastro, compras, pagamento, entrega, trocas e responsabilidades.",
    url: `${SITE_URL}/termos-de-uso`,
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
          <h1 className="mb-4">Termos de Uso</h1>
          <p className={styles.headerText}>
            As condições para usar a loja Luratha e realizar suas compras com segurança e
            transparência.
          </p>
          <p className={styles.updatedAt}>Última atualização: {LAST_UPDATED_LABEL}</p>
        </div>

        <div className={styles.sections}>
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              {section.paragraphs?.map((text, i) => (
                <p key={i} className={styles.sectionText}>
                  {text}
                </p>
              ))}
              {section.links && (
                <p className={styles.sectionText}>
                  {section.links.map((link, i) => (
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
            Ficou com alguma dúvida sobre os termos?{" "}
            <Link href="/contato" className={styles.contactNoteLink}>
              Fale conosco
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
