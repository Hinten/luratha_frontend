"use client";
import type { Route } from "next";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import styles from "./SortDropdown.module.css";

export const SORT_OPTIONS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "maior-desconto", label: "Maior desconto" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

interface SortDropdownProps {
  currentSort?: string;
}

export default function SortDropdown({
  currentSort = "recentes",
}: SortDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "recentes") {
        params.delete("sort");
      } else {
        params.set("sort", value);
      }
      const query = params.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      router.push(href as Route);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className={styles.wrapper}>
      <label htmlFor="sort-select" className={styles.label}>
        Ordenar por:
      </label>
      <select
        id="sort-select"
        value={currentSort}
        onChange={(e) => handleChange(e.target.value)}
        className={styles.select}
      >
        {SORT_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

