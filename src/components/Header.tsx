"use client";
import React, { useState } from "react";
import Link from "next/link";
import { appData } from "@/src/lib/constants";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-neutral-light)]/95 backdrop-blur-sm border-b border-[var(--color-neutral-mid)]">
      <div className="container-luratha flex items-center justify-between h-16 md:h-20">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img
            src={appData.logo}
            alt={appData.name}
            className="h-8 w-auto"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { href: "/colecao", label: "Coleção" },
            { href: "/sobre", label: "Sobre" },
            { href: "/contato", label: "Contato" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="font-[family-name:var(--font-inter)] font-medium text-[15px] uppercase tracking-[0.05em] text-[var(--color-neutral-dark)] hover:text-[var(--color-primary)] transition-colors duration-300"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Cart icon */}
          <button
            aria-label="Carrinho"
            className="text-[var(--color-neutral-dark)] hover:text-[var(--color-primary)] transition-colors duration-300"
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
          </button>

          {/* Hamburger (mobile) */}
          <button
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            className="md:hidden text-[var(--color-neutral-dark)] hover:text-[var(--color-primary)] transition-colors duration-300"
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
        <div className="md:hidden bg-[var(--color-neutral-light)] border-t border-[var(--color-neutral-mid)] px-6 py-6 flex flex-col gap-6">
          {[
            { href: "/colecao", label: "Coleção" },
            { href: "/sobre", label: "Sobre" },
            { href: "/contato", label: "Contato" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="font-[family-name:var(--font-inter)] font-medium text-lg uppercase tracking-[0.05em] text-[var(--color-neutral-dark)] hover:text-[var(--color-primary)] transition-colors duration-300"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
