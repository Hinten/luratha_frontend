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
        <span aria-hidden="true">🔍</span>
      </button>
    </form>
  );
}
