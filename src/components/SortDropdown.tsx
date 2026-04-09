"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

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
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="sort-select"
        className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/70 whitespace-nowrap"
      >
        Ordenar por:
      </label>
      <select
        id="sort-select"
        value={currentSort}
        onChange={(e) => handleChange(e.target.value)}
        className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)] bg-[var(--color-neutral-light)] border border-[var(--color-neutral-mid)] rounded-xl px-3 py-2 cursor-pointer hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-colors duration-300"
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
