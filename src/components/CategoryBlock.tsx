import Link from "next/link";
import type { Category } from "@/src/lib/types";

interface CategoryBlockProps {
  category: Category;
}

export default function CategoryBlock({ category }: CategoryBlockProps) {
  const { label, href, imageUrl } = category;

  return (
    <Link
      href={href}
      aria-label={label}
      className="group relative flex-1 min-w-0 rounded-3xl overflow-hidden block"
      style={{ aspectRatio: "6/7" }}
    >
      <img
        src={imageUrl}
        alt=""
        role="presentation"
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-neutral-dark)]/60 via-transparent to-transparent" />
      {/* Label */}
      <span className="absolute bottom-6 left-0 right-0 text-center font-[family-name:var(--font-heading)] text-white text-2xl font-semibold">
        {label}
      </span>
    </Link>
  );
}
