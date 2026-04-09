import { Product } from "@/src/lib/types";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const discount = product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100
      )
    : 0;

  return (
    <article className="group relative flex flex-col bg-[var(--color-neutral-light)] rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
      {/* Image */}
      <div className="relative aspect-square bg-[var(--color-accent)] overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {product.isArtisanal && (
            <span className="bg-[var(--color-secondary)] text-[var(--color-neutral-dark)] text-xs font-medium px-2 py-0.5 rounded-full">
              Artesanal
            </span>
          )}
          {discount > 0 && (
            <span className="bg-[var(--color-primary)] text-[var(--color-neutral-dark)] text-xs font-medium px-2 py-0.5 rounded-full">
              -{discount}%
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1">
        <h3 className="font-[family-name:var(--font-body)] font-medium text-sm text-[var(--color-neutral-dark)] line-clamp-2">
          {product.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-[family-name:var(--font-body)] font-bold text-base text-[var(--color-neutral-dark)]">
            R$ {product.price.toFixed(2).replace(".", ",")}
          </span>
          {product.originalPrice && (
            <span className="font-[family-name:var(--font-body)] text-sm text-[var(--color-neutral-dark)]/50 line-through">
              R$ {product.originalPrice.toFixed(2).replace(".", ",")}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
