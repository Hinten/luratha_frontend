import type { Product } from "@/src/lib/types";

interface ProductCardProps {
  product: Product;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function ProductCard({ product }: ProductCardProps) {
  const {
    name,
    price,
    originalPrice,
    imageUrl,
    rating,
    reviewCount,
    installments,
  } = product;

  const hasDiscount =
    originalPrice !== undefined && originalPrice > price;
  const discountPct = hasDiscount
    ? Math.round((1 - price / originalPrice!) * 100)
    : 0;

  return (
    <article className="group relative flex flex-col rounded-3xl overflow-hidden bg-[var(--color-accent)] hover:-translate-y-0.5 transition-transform duration-300">
      {/* Discount badge */}
      {hasDiscount && (
        <span className="absolute top-3 left-3 z-10 bg-[var(--color-primary)] text-[var(--color-neutral-dark)] text-xs font-medium px-2.5 py-1 rounded-full">
          -{discountPct}%
        </span>
      )}

      {/* Favorite button */}
      <button
        aria-label={`Favoritar ${name}`}
        className="absolute top-3 right-3 z-10 text-[var(--color-neutral-dark)] hover:text-[var(--color-primary)] transition-colors duration-300"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
          />
        </svg>
      </button>

      {/* Image */}
      <div className="aspect-[4/5] overflow-hidden">
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-4">
        <h3 className="font-[family-name:var(--font-inter)] font-medium text-sm text-[var(--color-neutral-dark)] leading-snug line-clamp-2">
          {name}
        </h3>

        {/* Rating */}
        {rating !== undefined && (
          <div className="flex items-center gap-1 text-xs text-[var(--color-neutral-dark)]/70">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="#E8B9C9"
              className="w-3.5 h-3.5"
            >
              <path
                fillRule="evenodd"
                d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{rating.toFixed(1)}</span>
            {reviewCount !== undefined && (
              <span className="text-[var(--color-neutral-mid)]">({reviewCount})</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mt-1">
          {hasDiscount && (
            <span className="block text-xs text-[var(--color-neutral-dark)]/50 line-through">
              {formatBRL(originalPrice!)}
            </span>
          )}
          <span className="block text-base font-semibold text-[var(--color-neutral-dark)]">
            {formatBRL(price)}
          </span>
          {installments && (
            <span className="block text-xs text-[var(--color-neutral-dark)]/60">
              {installments.count}x {formatBRL(installments.value)} sem juros
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
