import type { FirestoreCategory, Product as FirestoreProduct, Stock } from "@/src/schemas/firestore";
import Breadcrumb from "@/src/components/Breadcrumb";
import ProductGallery from "@/src/components/produto/ProductGallery";
import PriceBlock from "@/src/components/produto/PriceBlock";
import SizeSelector from "@/src/components/produto/SizeSelector";
import ProductHighlights from "@/src/components/produto/ProductHighlights";
import ProductDescription from "@/src/components/produto/ProductDescription";
import { getProductGalleryImages } from "@/src/lib/productImages";
import styles from "./ProductDetailPage.module.css";

const DEFAULT_PRODUCT_IMAGE_URL = "https://placehold.co/600x750/F8F5F0/3A2F2A?text=Produto";

interface ProductDetailPageProps {
  product: FirestoreProduct;
  category?: FirestoreCategory | null;
  stock?: Stock | null;
}

export default function ProductDetailPage({ product, category, stock }: ProductDetailPageProps) {
  const categorySlug = category?.slug ?? "outros";
  const categoryLabel = category?.name ?? "Outros";
  const categoryHref = `/categoria/${categorySlug}`;
  const images = getProductGalleryImages(product, DEFAULT_PRODUCT_IMAGE_URL);
  const currentPrice = product.price.salePrice ?? product.price.price;
  const originalPrice = product.price.salePrice ? product.price.price : undefined;
  const sizes = extractUniqueSizes(product);
  const highlights = product.productHighlight ?? [];

  // Use stock collection data when available; fall back to embedded product data
  const totalQuantity = stock?.quantity ?? product.totalStock;
  const availability = totalQuantity > 0
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: images.map((image) => image.defaultUrl),
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brandName },
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: currentPrice,
      availability,
      url: `https://www.luratha.com.br/produto/${product.slug}`,
    },
    ...(product.ratingAverage !== null && product.reviewCount !== null && product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAverage.toFixed(1),
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <div className="container-luratha section-padding">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: categoryLabel, href: categoryHref },
            { label: product.title },
          ]}
        />

        {/* Main two-column layout */}
        <div className={styles.productLayout}>
          {/* Gallery column */}
          <div className={styles.galleryCol}>
            <ProductGallery
              images={images}
              productName={product.title}
            />
          </div>

          {/* Info column */}
          <div className={styles.infoCol}>
            <h1 className={styles.productName}>{product.title}</h1>

            {product.ratingAverage !== null && (
              <div className={styles.ratingRow}>
                <span className={styles.ratingStar} aria-hidden="true">
                  ★
                </span>
                <span className={styles.ratingValue}>
                  {product.ratingAverage.toFixed(1)}
                </span>
                {product.reviewCount !== null && (
                  <span className={styles.ratingCount}>
                    ({product.reviewCount} {product.reviewCount === 1 ? "avaliação" : "avaliações"})
                  </span>
                )}
              </div>
            )}

            <div className={styles.priceWrapper}>
              <PriceBlock
                price={currentPrice}
                originalPrice={originalPrice}
              />
            </div>

              <SizeSelector
                sizes={sizes}
                productName={product.title}
                productId={product.id}
                slug={product.slug}
                imageUrl={images[0]?.defaultUrl ?? DEFAULT_PRODUCT_IMAGE_URL}
                price={currentPrice}
              />

            <StockInfo stock={stock} product={product} />

            {/* Amazon-style bullet-point highlights */}
            {highlights.length > 0 && (
              <ProductHighlights highlights={highlights} />
            )}
          </div>
        </div>

        {/* Full description — always visible, below the two-column layout */}
        <ProductDescription description={product.description} />
      </div>
    </>
  );
}

function extractUniqueSizes(product: FirestoreProduct): string[] {
  return Array.from(
    new Set([
      ...(product.size ?? []),
      ...(product.variants?.flatMap((variant) => variant.size ?? []) ?? []),
    ]),
  );
}

interface StockInfoProps {
  stock?: Stock | null;
  product: FirestoreProduct;
}

function StockInfo({ stock, product }: StockInfoProps) {
  // Prefer stock collection data; fall back to embedded product fields
  const totalQuantity = stock?.quantity ?? product.totalStock;

  if (totalQuantity === 0) {
    return (
      <p className={styles.stockOutOfStock} aria-label="Disponibilidade do produto">
        Esgotado
      </p>
    );
  }

  if (stock?.hasVariants && stock.variants) {
    return (
      <div className={styles.stockInfo} aria-label="Estoque por variação">
        {Object.entries(stock.variants).map(([variantSku, qty]) => {
          const variant = product.variants?.find((v) => v.sku === variantSku);
          const label = variant?.size?.join(" / ") ?? variantSku;
          const isLow = qty > 0 && qty <= 3;
          return (
            <p key={variantSku} className={qty === 0 ? styles.stockVariantOut : styles.stockVariantIn}>
              {label}:{" "}
              {qty === 0 ? (
                "Esgotado"
              ) : isLow ? (
                <span className={styles.stockLow}>Últimas {qty} unid.</span>
              ) : (
                `${qty} disponíveis`
              )}
            </p>
          );
        })}
      </div>
    );
  }

  if (totalQuantity <= 3) {
    return (
      <p className={styles.stockLow} aria-label="Disponibilidade do produto">
        Últimas {totalQuantity} unidades
      </p>
    );
  }

  return (
    <p className={styles.stockInStock} aria-label="Disponibilidade do produto">
      {totalQuantity} unidades disponíveis
    </p>
  );
}
