import type { Metadata } from "next";

/**
 * Layout enxuto do checkout — sem header/footer da loja para reduzir distração
 * durante a finalização. As páginas filhas usam o container próprio do
 * CheckoutFlow.
 *
 * `robots: noindex` aqui é redundante (já no robots.ts) mas explícito.
 */
export const metadata: Metadata = {
  title: "Checkout — Luratha",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
