import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import styles from "./Sidebar.module.css";

/**
 * Admin shell navigation. Nav items are added as later phases ship routes
 * (Configurações, Catálogo, Pedidos).
 */
export function Sidebar({ email }: { email: string | null }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>Luratha Admin</div>

      <nav className={styles.nav} aria-label="Navegação principal">
        <Link href="/" className={styles.navLink}>
          Início
        </Link>
        <Link href="/configuracoes" className={styles.navLink}>
          Configurações
        </Link>
        <Link href="/configuracoes/empresa" className={styles.navLink}>
          Dados da empresa
        </Link>
      </nav>

      <div className={styles.footer}>
        {email && (
          <span className={styles.email} title={email}>
            {email}
          </span>
        )}
        <LogoutButton />
      </div>
    </aside>
  );
}
