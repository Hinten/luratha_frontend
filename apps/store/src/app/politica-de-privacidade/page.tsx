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
  title: "Política de Privacidade",
  description:
    "Como a Luratha coleta, usa, compartilha e protege seus dados pessoais, em conformidade com a LGPD (Lei nº 13.709/2018). Conheça seus direitos como titular.",
  alternates: { canonical: `${SITE_URL}/politica-de-privacidade` },
  openGraph: {
    title: "Política de Privacidade | Luratha",
    description:
      "Como a Luratha trata seus dados pessoais em conformidade com a LGPD. Finalidades, base legal, compartilhamento e seus direitos.",
    url: `${SITE_URL}/politica-de-privacidade`,
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
  items?: string[];
  links?: { href: Route; label: string }[];
};

function orPlaceholder(value: string, placeholder: string): string {
  return value.trim().length > 0 ? value : placeholder;
}

/**
 * MINUTA — texto-base de privacidade (LGPD). Os dados de identificação vêm de
 * `siteSettings.company`, editáveis no admin (/configuracoes/empresa). Requer
 * revisão jurídica antes da publicação definitiva.
 */
function buildSections(company: CompanySettings): Section[] {
  const controller = orPlaceholder(company.legalName, "[INSERIR RAZÃO SOCIAL]");
  const cnpj = orPlaceholder(company.cnpj, "[INSERIR CNPJ]");
  const contactEmail = orPlaceholder(company.contactEmail, "[INSERIR E-MAIL DE CONTATO]");
  const dpoName = orPlaceholder(company.dpoName, "[INSERIR NOME DO ENCARREGADO]");
  const dpoEmail = orPlaceholder(company.dpoEmail, "[INSERIR E-MAIL DO ENCARREGADO]");

  return [
    {
      title: "1. Quem é o controlador dos seus dados",
      paragraphs: [
        `${controller}, inscrita no CNPJ ${cnpj}, é a controladora dos dados pessoais tratados neste site (luratha.com.br) e responsável por decidir como e por que eles são utilizados. Para qualquer questão sobre privacidade, fale conosco pelo e-mail ${contactEmail}.`,
      ],
    },
    {
      title: "2. Quais dados coletamos",
      paragraphs: ["Coletamos apenas os dados necessários para operar a loja e atender você:"],
      items: [
        "Dados de cadastro: nome, e-mail, CPF, telefone e senha de acesso.",
        "Dados de entrega: endereço completo e CEP informados no checkout.",
        "Dados de pedido e pagamento: itens comprados, valores e status. O pagamento é processado pelo MercadoPago — não armazenamos os dados completos do seu cartão.",
        "Dados de navegação: endereço IP, identificadores de dispositivo, páginas visitadas e cookies.",
      ],
    },
    {
      title: "3. Para que usamos seus dados",
      items: [
        "Processar pedidos, pagamentos e emitir documentos fiscais.",
        "Calcular o frete e realizar a entrega dos produtos.",
        "Prestar atendimento e responder solicitações.",
        "Prevenir fraudes e garantir a segurança das transações.",
        "Enviar comunicações e ofertas, quando você consentir.",
        "Cumprir obrigações legais, fiscais e regulatórias.",
      ],
    },
    {
      title: "4. Base legal do tratamento",
      paragraphs: [
        "Tratamos seus dados com fundamento nas hipóteses do art. 7º da LGPD: execução de contrato (para concluir sua compra), cumprimento de obrigação legal (fiscal e tributária), legítimo interesse (segurança e melhoria da loja) e consentimento (para comunicações de marketing, que você pode revogar a qualquer momento).",
      ],
    },
    {
      title: "5. Com quem compartilhamos",
      paragraphs: [
        "Compartilhamos dados apenas com parceiros essenciais à operação, e na medida necessária:",
      ],
      items: [
        "MercadoPago — processamento de pagamentos (PIX, cartão e boleto).",
        "Melhor Envio, Correios e transportadoras — cálculo de frete e entrega.",
        "Google Firebase / Google Cloud — hospedagem e infraestrutura.",
        "Autoridades públicas — quando houver exigência legal ou ordem judicial.",
      ],
    },
    {
      title: "6. Cookies",
      paragraphs: [
        "Utilizamos cookies essenciais (que mantêm sua sessão e o carrinho) e cookies de análise (que nos ajudam a entender o uso do site). Você pode gerenciar ou bloquear cookies nas configurações do seu navegador, ciente de que isso pode afetar funcionalidades da loja.",
      ],
    },
    {
      title: "7. Seus direitos como titular",
      paragraphs: ["Nos termos do art. 18 da LGPD, você pode solicitar a qualquer momento:"],
      items: [
        "Confirmação da existência de tratamento e acesso aos seus dados.",
        "Correção de dados incompletos, inexatos ou desatualizados.",
        "Anonimização, bloqueio ou eliminação de dados desnecessários.",
        "Portabilidade dos dados a outro fornecedor.",
        "Informação sobre as entidades com quem compartilhamos seus dados.",
        "Revogação do consentimento e eliminação dos dados tratados com base nele.",
      ],
    },
    {
      title: "8. Encarregado pelo Tratamento de Dados (DPO)",
      paragraphs: [
        `Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, fale com o nosso Encarregado de Dados: ${dpoName} — ${dpoEmail}. Responderemos à sua solicitação nos prazos previstos na LGPD.`,
      ],
    },
    {
      title: "9. Segurança e retenção",
      paragraphs: [
        "Adotamos medidas técnicas e administrativas para proteger seus dados contra acessos não autorizados e situações acidentais ou ilícitas. Mantemos os dados apenas pelo tempo necessário às finalidades informadas ou ao cumprimento de obrigações legais, após o que são eliminados ou anonimizados.",
      ],
    },
    {
      title: "10. Alterações desta política",
      paragraphs: [
        `Podemos atualizar esta Política de Privacidade para refletir mudanças legais ou operacionais. A versão vigente é sempre a publicada nesta página. Consulte também os nossos Termos de Uso.`,
      ],
      links: [{ href: "/termos-de-uso", label: "Termos de Uso" }],
    },
  ];
}

export default async function PoliticaDePrivacidadePage() {
  const { company } = await getCachedSiteSettings();
  const sections = buildSections(company);

  const schema = {
    "@context": "https://schema.org" as const,
    "@type": "WebPage",
    name: "Política de Privacidade",
    description:
      "Como a Luratha coleta, usa, compartilha e protege seus dados pessoais, em conformidade com a LGPD.",
    url: `${SITE_URL}/politica-de-privacidade`,
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
          <h1 className="mb-4">Política de Privacidade</h1>
          <p className={styles.headerText}>
            Sua privacidade importa. Saiba como tratamos seus dados pessoais em conformidade com a
            LGPD (Lei nº 13.709/2018).
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
              {section.items && (
                <ul className={styles.list}>
                  {section.items.map((item) => (
                    <li key={item} className={styles.listItem}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
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
            Dúvidas sobre o tratamento dos seus dados?{" "}
            <Link href="/contato" className={styles.contactNoteLink}>
              Fale conosco
            </Link>{" "}
            e nosso time responderá.
          </p>
        </div>
      </div>
    </div>
  );
}
