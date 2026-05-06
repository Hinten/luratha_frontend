"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useAuth } from "@/src/contexts/AuthContext";
import styles from "./AccountSidebar.module.css";

const links = [
  { href: "/conta", label: "Resumo" },
  { href: "/conta/dados", label: "Meus dados" },
  { href: "/conta/enderecos", label: "Endereços" },
  { href: "/conta/pedidos", label: "Pedidos" },
] as const satisfies ReadonlyArray<{ href: Route; label: string }>;

export default function AccountSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  function isActive(href: string): boolean {
    if (href === "/conta") return pathname === "/conta";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className={styles.sidebar} aria-label="Navegação da conta">
      <ul className={styles.list}>
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className={`${styles.link} ${isActive(href) ? styles.linkActive : ""}`}
              aria-current={isActive(href) ? "page" : undefined}
            >
              {label}
            </Link>
          </li>
        ))}
        <li>
          <button type="button" onClick={logout} className={styles.logoutBtn}>
            Sair
          </button>
        </li>
      </ul>
    </nav>
  );
}
