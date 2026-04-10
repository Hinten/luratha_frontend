import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/src/components/Header";
import Footer from "@/src/components/Footer";
import WhatsAppButton from "@/src/components/WhatsAppButton";
import JsonLd from "@/src/components/JsonLd";
import type { Organization, WebSite, WithContext } from "schema-dts";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const BASE_URL = "https://www.luratha.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Luratha – Moda Artesanal Feminina",
    template: "%s | Luratha",
  },
  description:
    "Peças feitas com amor para durar. Slow fashion brasileiro com foco em artesanato, versatilidade e sustentabilidade.",
  keywords: [
    "slow fashion",
    "moda artesanal",
    "roupas femininas",
    "moda brasileira",
    "luratha",
    "vestidos artesanais",
    "roupas sustentáveis",
  ],
  authors: [{ name: "Luratha" }],
  creator: "Luratha",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: BASE_URL,
    siteName: "Luratha",
    title: "Luratha – Moda Artesanal Feminina",
    description:
      "Peças feitas com amor para durar. Slow fashion brasileiro com foco em artesanato, versatilidade e sustentabilidade.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Luratha – Moda Artesanal Feminina",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Luratha – Moda Artesanal Feminina",
    description:
      "Peças feitas com amor para durar. Slow fashion brasileiro com foco em artesanato, versatilidade e sustentabilidade.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
};

const organizationSchema: WithContext<Organization> = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Luratha",
  url: BASE_URL,
  logo: `${BASE_URL}/luratha.svg`,
  sameAs: [
    "https://instagram.com/_luratha",
    "https://facebook.com/Lurathaa",
    "https://youtube.com/channel/UC2RLNR2ZAzUxB97XYNFUnBg",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+55-12-98278-9225",
    contactType: "customer service",
    availableLanguage: "Portuguese",
    areaServed: "BR",
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "BR",
  },
};

const websiteSchema: WithContext<WebSite> = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Luratha",
  url: BASE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/todas-as-pecas?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${playfairDisplay.variable} ${inter.variable}`}>
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
        <Header />
        <main>{children}</main>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
