"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import AccountSidebar from "@/src/components/conta/AccountSidebar";
import styles from "./layout.module.css";

/**
 * Layout protegido das páginas de conta.
 *
 * O middleware real entra em PR 6 (Firebase Auth + cookie SSR). Por enquanto,
 * usamos o mock de AuthContext: se o usuário não estiver autenticado, redireciona
 * para /login com `?redirect=` para voltar depois.
 */
export default function ContaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (user === null && !isAuthenticated) {
      const redirect = encodeURIComponent(pathname || "/conta");
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [isAuthenticated, user, pathname, router]);

  if (!isAuthenticated) {
    return (
      <main className={styles.page}>
        <div className={`container-luratha ${styles.inner}`}>
          <p className={styles.checkingAuth}>Carregando…</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={`container-luratha ${styles.inner}`}>
        <h1 className={styles.heading}>Minha conta</h1>
        <div className={styles.layout}>
          <aside className={styles.sidebarCol}>
            <AccountSidebar />
          </aside>
          <section className={styles.contentCol}>{children}</section>
        </div>
      </div>
    </main>
  );
}
