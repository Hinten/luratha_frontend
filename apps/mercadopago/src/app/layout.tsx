import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Luratha — MercadoPago Webhook",
  description: "Receiver isolado de notificações do MercadoPago.",
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
