import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Luratha — Feeds de catálogo",
  description: "Backend isolado que gera o feed de produtos para Google Merchant e Facebook.",
  // Backend-only — never index.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
