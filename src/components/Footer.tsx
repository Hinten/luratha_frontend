"use client";
import React from "react";
import Link from "next/link";
import { appData } from "@/src/lib/constants";
import Logo from "./Logo";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container-luratha section-padding">
        {/* Logo */}
        <div className={styles.logoWrapper}>
          <Logo />
        </div>

        {/* Links */}
        <nav className={styles.nav}>
          {[
            { href: "/colecao", label: "Coleção" },
            { href: "/sobre", label: "Sobre" },
            { href: "/contato", label: "Contato" },
            { href: "/politica-de-privacidade", label: "Privacidade" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className={styles.navLink}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className={styles.divider} />

        {/* Copyright */}
        <p className={styles.copyright}>
          &copy; {new Date().getFullYear()} {appData.name}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}

