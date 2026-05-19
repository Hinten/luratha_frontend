"use client";

import { useAuth } from "@/src/contexts/AuthContext";
import AccountSidebar from "@/src/components/conta/AccountSidebar";
import styles from "./layout.module.css";

export default function ContaLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
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
