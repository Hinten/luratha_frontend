"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import { useCart } from "@/src/contexts/CartContext";
import CheckoutFlow from "./CheckoutFlow";
import styles from "./page.module.css";

/**
 * Página do checkout — orquestrada pelo CheckoutFlow.
 *
 * Guards client-side:
 *   - usuário não logado → /login?redirect=%2Fcheckout (alinha com src/proxy.ts)
 *
 * O guard de carrinho vazio fica DENTRO do CheckoutFlow porque ele depende do
 * estado `paymentResult` — depois de gerar QR/boleto, o cart é limpo mas o
 * user deve continuar vendo o `PaymentResult` até clicar "Acompanhar pedido".
 * Se o guard rodasse aqui, o user seria mandado pro /carrinho assim que o
 * cart esvaziasse.
 *
 * A gating principal de auth acontece no src/proxy.ts via `__session` cookie.
 * Este guard cobre a janela rara em que o cookie sumiu no client.
 *
 * Página em si fica "noindex" via robots.ts (checkout não deve ser indexado).
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { isReady: cartReady } = useCart();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent("/checkout")}`);
    }
  }, [authLoading, user, router]);

  if (authLoading || !cartReady) {
    return (
      <main className={styles.loading}>
        <p>Carregando checkout…</p>
      </main>
    );
  }

  if (!user) {
    // Aguardando redirect.
    return null;
  }

  // Suspense boundary exigido pelo `useSearchParams` em client component
  // (CheckoutFlow lê `?step=` da URL).
  return (
    <Suspense fallback={null}>
      <CheckoutFlow />
    </Suspense>
  );
}
