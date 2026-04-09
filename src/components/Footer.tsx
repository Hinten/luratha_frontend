"use client";
import React from "react";
import Link from "next/link";
import { appData } from "@/src/lib/constants";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="bg-[var(--color-accent)] border-t border-[var(--color-neutral-mid)]">
      <div className="container-luratha section-padding">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        {/* Links */}
        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-8">
          {[
            { href: "/colecao", label: "Coleção" },
            { href: "/sobre", label: "Sobre" },
            { href: "/contato", label: "Contato" },
            { href: "/politica-de-privacidade", label: "Privacidade" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="font-[family-name:var(--font-inter)] text-sm text-[var(--color-neutral-dark)] hover:text-[var(--color-primary)] transition-colors duration-300"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="border-t border-[var(--color-neutral-mid)] mb-8" />

        {/* Copyright */}
        <p className="text-center font-[family-name:var(--font-inter)] text-sm text-[var(--color-neutral-dark)]/70">
          &copy; {new Date().getFullYear()} {appData.name}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
