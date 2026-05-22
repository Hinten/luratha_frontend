import type { Metadata } from "next";
import { contactData } from "@/src/lib/constants";
import styles from "./page.module.css";
import JsonLd from "@/src/components/JsonLd";
import { SITE_URL, LURATHA_SCHEMA, DEFAULT_OG_IMAGE } from "@/src/lib/seoConstants";

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Entre em contato com a Luratha pelo WhatsApp, telefone ou formulário. Estamos aqui para ajudar com dúvidas, trocas e pedidos.",
  alternates: { canonical: `${SITE_URL}/contato` },
  openGraph: {
    title: "Fale Conosco – Luratha",
    description:
      "Entre em contato com a Luratha pelo WhatsApp, telefone ou formulário.",
    url: `${SITE_URL}/contato`,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

const contactPageSchema = {
  "@context": "https://schema.org" as const,
  "@type": "ContactPage",
  name: "Fale Conosco – Luratha",
  description:
    "Entre em contato com a Luratha pelo WhatsApp, telefone ou formulário.",
  url: `${SITE_URL}/contato`,
};

const localBusinessSchema = {
  "@context": "https://schema.org" as const,
  "@type": "LocalBusiness",
  name: LURATHA_SCHEMA.name,
  url: LURATHA_SCHEMA.url,
  logo: LURATHA_SCHEMA.logo,
  telephone: LURATHA_SCHEMA.telephone,
  sameAs: LURATHA_SCHEMA.sameAs,
  address: {
    "@type": "PostalAddress",
    addressCountry: "BR",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: LURATHA_SCHEMA.telephone,
      contactType: "customer service",
      contactOption: "TollFree",
      availableLanguage: "Portuguese",
    },
  ],
};

const SOCIAL_LINKS = [
  { href: contactData.instagram, label: "Instagram" },
  { href: contactData.facebook, label: "Facebook" },
  { href: contactData.youtube, label: "YouTube" },
];

export default function ContatoPage() {
  return (
    <div className="container-luratha section-padding">
      <JsonLd data={contactPageSchema} />
      <JsonLd data={localBusinessSchema} />
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className="mb-4">Fale Conosco</h1>
          <p className={styles.headerText}>
            Estamos aqui para ajudar. Entre em contato pelos canais abaixo ou
            preencha o formulário.
          </p>
        </div>

        <div className={styles.grid}>
          {/* Contact info */}
          <div className={styles.contactInfo}>
            <h2 className={styles.sectionHeading}>Atendimento</h2>

            {/* WhatsApp */}
            <a
              href={`https://wa.me/${contactData.whatsapp}?text=Ol%C3%A1!%20Estou%20olhando%20o%20site%20e%20gostaria%20de%20algumas%20informa%C3%A7%C3%B5es`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsappBtn}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={styles.icon}
                aria-hidden="true"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp: {contactData.phone}
            </a>

            {/* Phone */}
            <a
              href={`tel:${contactData.phoneTel}`}
              className={styles.phoneBtn}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={styles.icon}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
                />
              </svg>
              Telefone: {contactData.phone}
            </a>

            {/* Social media */}
            <div className={styles.socials}>
              {SOCIAL_LINKS.map(({ href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialBtn}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Contact form */}
          <div className={styles.formSection}>
            <h2 className={styles.formHeading}>Envie uma mensagem</h2>
            <form action="" className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="contact-name" className={styles.fieldLabel}>
                  Nome
                </label>
                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  required
                  placeholder="Seu nome"
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="contact-email" className={styles.fieldLabel}>
                  E-mail
                </label>
                <input
                  id="contact-email"
                  type="email"
                  name="email"
                  required
                  placeholder="seu@email.com"
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="contact-message" className={styles.fieldLabel}>
                  Mensagem
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Como podemos ajudar?"
                  className={styles.textarea}
                />
              </div>
              <button type="submit" className={styles.submitBtn}>
                Enviar mensagem
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


