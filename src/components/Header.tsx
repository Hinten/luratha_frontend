"use client";
import React, { Suspense, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import Logo from "./Logo";
import DevSeedButton from "@/src/components/home/DevSeedButton";
import SearchInput from "@/src/components/busca/SearchInput";
import styles from "./Header.module.css";
import { useCart } from "@/src/contexts/CartContext";
import { useAuth } from "@/src/contexts/AuthContext";

const navItems = [
  { href: "/todas-as-pecas", label: "Coleção" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
] as const satisfies ReadonlyArray<{ href: Route; label: string }>;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { totalItems } = useCart();
  const { user, isAuthenticated, logout } = useAuth();

  const firstName = user?.name.split(" ")[0] ?? "";

  function handleMobileLinkClick() {
    setMenuOpen(false);
  }

  function handleMobileLogout() {
    logout();
    setMenuOpen(false);
  }

  return (
    <header className={styles.header}>
      <div className={`container-luratha ${styles.inner}`}>
        <Logo />
        <div className={styles.searchArea}>
          <Suspense fallback={null}>
            <SearchInput />
          </Suspense>
        </div>

        {/* Desktop Navigation */}
        <nav className={styles.desktopNav}>
          {navItems.map(({ href, label }) => (
            <Link key={href} href={href} className={styles.navLink}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className={styles.actions}>
          <div className={styles.desktopOnly}>
            <DevSeedButton enabled={process.env.NODE_ENV === "development"} />
          </div>

          {/* User: "Entrar" link or first name → account */}
          {isAuthenticated ? (
            <span className={`${styles.userGreeting} ${styles.desktopOnly}`}>
              <Link href="/conta" className={styles.navLink} aria-label="Ir para minha conta">
                Olá, {firstName}
              </Link>
              <button
                type="button"
                className={styles.sairBtn}
                onClick={logout}
                aria-label="Sair da conta"
              >
                Sair
              </button>
            </span>
          ) : (
            <Link
              href="/login"
              className={`${styles.navLink} ${styles.desktopOnly}`}
              aria-label="Entrar"
            >
              Entrar
            </Link>
          )}

          {/* Cart link with item count badge */}
          <Link
            href="/carrinho"
            aria-label="Carrinho"
            className={`${styles.iconBtn} ${styles.cartBtn}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z"
              />
            </svg>
            {totalItems > 0 && (
              <span className={styles.cartBadge} aria-hidden="true">
                {totalItems}
              </span>
            )}
          </Link>

          {/* Hamburger (mobile) */}
          <button
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            className={`${styles.iconBtn} ${styles.hamburger}`}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {menuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile overlay menu */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={handleMobileLinkClick}
              className={styles.mobileNavLink}
            >
              {label}
            </Link>
          ))}

          {/* Auth links in mobile menu */}
          {isAuthenticated ? (
            <>
              <span className={styles.mobileUserName}>Olá, {firstName}</span>
              <Link
                href="/conta"
                onClick={handleMobileLinkClick}
                className={styles.mobileNavLink}
              >
                Minha conta
              </Link>
              <DevSeedButton enabled={process.env.NODE_ENV === "development"} />
              <button
                type="button"
                className={styles.mobileNavLink}
                onClick={handleMobileLogout}
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <DevSeedButton enabled={process.env.NODE_ENV === "development"} />
              <Link
                href="/login"
                onClick={handleMobileLinkClick}
                className={styles.mobileNavLink}
              >
                Entrar
              </Link>
              <Link
                href="/register"
                onClick={handleMobileLinkClick}
                className={styles.mobileNavLink}
              >
                Cadastrar
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
