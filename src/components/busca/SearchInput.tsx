"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./SearchInput.module.css";

export default function SearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialTerm = searchParams.get("q") ?? "";
  const [term, setTerm] = useState(initialTerm);

  const placeholder = useMemo(
    () => (pathname.startsWith("/categoria/") ? "Buscar nesta categoria" : "Buscar produtos"),
    [pathname],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTerm = term.trim();
    const params = new URLSearchParams(pathname === "/busca" ? searchParams.toString() : "");

    if (nextTerm) {
      params.set("q", nextTerm);
      params.delete("page");
      const query = params.toString();
      router.push(query ? `/busca?${query}` : "/busca");
      return;
    }

    router.push("/busca");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} role="search" aria-label="Buscar produtos">
      <label htmlFor="header-search-input" className={styles.srOnly}>
        Buscar produtos
      </label>
      <div className={styles.inputShell}>
        <input
          id="header-search-input"
          name="q"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.currentTarget.value)}
          placeholder={placeholder}
          className={styles.input}
          aria-label="Buscar produtos"
        />
        <button type="submit" className={styles.button} aria-label="Executar busca">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.icon}
          >
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </form>
  );
}
