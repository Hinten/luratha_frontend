import type { Product as FirestoreProduct } from "@/src/schemas/firestore";
import Breadcrumb from "@/src/components/Breadcrumb";
import ProductGallery from "@/src/components/produto/ProductGallery";
import PriceBlock from "@/src/components/produto/PriceBlock";
import SizeSelector from "@/src/components/produto/SizeSelector";
import ProductHighlights from "@/src/components/produto/ProductHighlights";
import ProductDescription from "@/src/components/produto/ProductDescription";
import styles from "./ProductDetailPage.module.css";

const DEFAULT_PRODUCT_IMAGE_URL = "https://placehold.co/600x750/F8F5F0/3A2F2A?text=Produto";

interface ProductDetailPageProps {
  product: FirestoreProduct;
}

export default function ProductDetailPage({ product }: ProductDetailPageProps) {
  const primaryCategory = product.category[0];
  const categorySlug = primaryCategory?.slug ?? "outros";
  const categoryLabel = primaryCategory?.name ?? "Outros";
  const categoryHref = `/categoria/${categorySlug}`;
  const images = product.photoIds.length > 0 ? product.photoIds : [DEFAULT_PRODUCT_IMAGE_URL];
  const currentPrice = product.price.salePrice ?? product.price.price;
  const originalPrice = product.price.salePrice ? product.price.price : undefined;
  const sizes = extractUniqueSizes(product);
  const highlights = product.productHighlight ?? [];
  const availability = product.totalStock > 0
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: images,
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
              imageUrl={images[0]}
              price={currentPrice}
            />

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
