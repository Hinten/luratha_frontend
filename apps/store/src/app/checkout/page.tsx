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
 *   - carrinho vazio (depois de hidratado) → /carrinho
 *
 * A gating principal de auth acontece no src/proxy.ts via `__session` cookie.
 * Este guard cobre a janela rara em que o cookie sumiu no client.
 *
 * Página em si fica "noindex" via robots.ts (checkout não deve ser indexado).
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { items, isReady: cartReady } = useCart();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent("/checkout")}`);
      return;
    }
    if (cartReady && items.length === 0) {
      router.replace("/carrinho");
    }
  }, [authLoading, user, cartReady, items.length, router]);

  if (authLoading || !cartReady) {
    return (
      <main className={styles.loading}>
        <p>Carregando checkout…</p>
      </main>
    );
  }

  if (!user || items.length === 0) {
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
