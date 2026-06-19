import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/src/components/Header";
import Footer from "@/src/components/Footer";
import WhatsAppButton from "@/src/components/WhatsAppButton";
import JsonLd from "@/src/components/JsonLd";
import Providers from "@/src/components/Providers";
import Analytics from "@/src/components/analytics/Analytics";
import MetaPixel from "@/src/components/analytics/MetaPixel";
import { getCachedSiteSettings } from "@/src/lib/queries/getCachedSiteSettings";
import { SITE_URL, LURATHA_SCHEMA, DEFAULT_OG_IMAGE } from "@/src/lib/seoConstants";

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

const organizationSchema = {
  "@context": "https://schema.org" as const,
  "@type": "Organization",
  name: LURATHA_SCHEMA.name,
  url: LURATHA_SCHEMA.url,
  logo: LURATHA_SCHEMA.logo,
  telephone: LURATHA_SCHEMA.telephone,
  sameAs: LURATHA_SCHEMA.sameAs,
  contactPoint: {
    "@type": "ContactPoint",
    telephone: LURATHA_SCHEMA.telephone,
    contactType: "customer service",
    availableLanguage: "Portuguese",
    areaServed: "BR",
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "BR",
  },
};

const websiteSchema = {
  "@context": "https://schema.org" as const,
  "@type": "WebSite",
  name: LURATHA_SCHEMA.name,
  url: LURATHA_SCHEMA.url,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/busca?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Luratha | Moda Artesanal Feminina",
    template: "%s | Luratha",
  },
  description:
    "Peças feitas com amor para durar. Slow fashion brasileiro com foco em artesanato, versatilidade e sustentabilidade.",
  keywords: ["slow fashion", "moda artesanal", "roupas femininas", "moda brasileira", "luratha"],
  authors: [{ name: "Luratha" }],
  creator: "Luratha",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "Luratha",
    title: "Luratha | Moda Artesanal Feminina",
    description:
      "Peças feitas com amor para durar. Slow fashion brasileiro com foco em artesanato, versatilidade e sustentabilidade.",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Luratha | Moda Artesanal Feminina",
    description:
      "Peças feitas com amor para durar. Slow fashion brasileiro com foco em artesanato, versatilidade e sustentabilidade.",
    images: [DEFAULT_OG_IMAGE.url],
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
    canonical: SITE_URL,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Measurement ID: admin (settings/global.marketing) é a fonte da verdade, com
  // fallback para a env. `getCachedSiteSettings` é deduplicado por render
  // (cache()), então o Footer reaproveita a mesma leitura sem custo extra.
  const { marketing } = await getCachedSiteSettings();
  const gaMeasurementId = marketing.ga4Enabled
    ? marketing.ga4MeasurementId || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || ""
    : "";
  // Meta Pixel: admin (settings/global.marketing) é a fonte da verdade. Vazio
  // (sem ID ou toggle desligado) = Pixel desligado.
  const metaPixelId = marketing.metaPixelEnabled ? marketing.metaPixelId : "";

  return (
    <html lang="pt-BR">
      <body className={`${playfairDisplay.variable} ${inter.variable}`}>
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
        <Analytics measurementId={gaMeasurementId} />
        <MetaPixel pixelId={metaPixelId} />
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
          <WhatsAppButton />
        </Providers>
      </body>
    </html>
  );
}
