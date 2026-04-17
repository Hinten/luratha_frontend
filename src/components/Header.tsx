"use client";
import React, { Suspense, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import DevSeedButton from "@/src/components/home/DevSeedButton";
import SearchInput from "@/src/components/busca/SearchInput";
import styles from "./Header.module.css";
import { useCart } from "@/src/contexts/CartContext";
import { useAuth } from "@/src/contexts/AuthContext";

const navItems = [
  { href: "/categoria", label: "Categorias" },
  { href: "/sobre", label: "Sobre" },
  { href: "/contato", label: "Contato" },
];

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
          <div className={styles.searchArea}>
            <Suspense fallback={null}>
              <SearchInput />
            </Suspense>
          </div>
          <DevSeedButton enabled={process.env.NODE_ENV === "development"} />

          {/* User: "Entrar" link or first name → account */}
          {isAuthenticated ? (
            <span className={styles.userGreeting}>
              Olá, {firstName}
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
            <Link href="/login" className={styles.navLink} aria-label="Entrar">
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
