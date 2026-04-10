import type { ProductDetail } from "@/src/lib/types";
import { CATEGORIES } from "@/src/lib/constants";
import { mockProducts } from "@/src/lib/mockData";
import Breadcrumb from "@/src/components/Breadcrumb";
import ProductGallery from "@/src/components/ProductGallery";
import PriceBlock from "@/src/components/PriceBlock";
import SizeSelector from "@/src/components/SizeSelector";
import ReviewsList from "@/src/components/ReviewsList";
import ProductCard from "@/src/components/ProductCard";
import styles from "./ProductDetailPage.module.css";

interface ProductDetailPageProps {
  product: ProductDetail;
}

export default function ProductDetailPage({ product }: ProductDetailPageProps) {
  const category = CATEGORIES.find((c) => c.slug === product.categorySlug);
  const categoryLabel = category?.label ?? product.categorySlug;
  const categoryHref = category?.href ?? `/categoria/${product.categorySlug}`;

  const relatedProducts = mockProducts
    .filter(
      (p) =>
        p.categorySlug === product.categorySlug && p.slug !== product.slug
    )
    .slice(0, 6);

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.id,
    brand: { "@type": "Brand", name: "Luratha" },
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: product.price,
      availability: "https://schema.org/InStock",
      url: `https://www.luratha.com.br/produto/${product.slug}`,
    },
    ...(product.reviews && product.reviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: (
              product.reviews.reduce((s, r) => s + r.rating, 0) /
              product.reviews.length
            ).toFixed(1),
            reviewCount: product.reviews.length,
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
            { label: product.name },
          ]}
        />

        {/* Main two-column layout */}
        <div className={styles.productLayout}>
          {/* Gallery column */}
          <div className={styles.galleryCol}>
            <ProductGallery
              images={product.images}
              productName={product.name}
            />
          </div>

          {/* Info column */}
          <div className={styles.infoCol}>
            <h1 className={styles.productName}>{product.name}</h1>

            {product.rating !== undefined && (
              <div className={styles.ratingRow}>
                <span className={styles.ratingStar} aria-hidden="true">
                  ★
                </span>
                <span className={styles.ratingValue}>
                  {product.rating.toFixed(1)}
                </span>
                {product.reviewCount !== undefined && (
                  <span className={styles.ratingCount}>
                    ({product.reviewCount}{" "}
                    {product.reviewCount === 1 ? "avaliação" : "avaliações"})
                  </span>
                )}
              </div>
            )}

            <div className={styles.priceWrapper}>
              <PriceBlock
                price={product.price}
                originalPrice={product.originalPrice}
                installments={product.installments}
              />
            </div>

            <SizeSelector
              sizes={product.sizes}
              productName={product.name}
            />

            {/* Collapsible description */}
            <details className={styles.descriptionDetails}>
              <summary className={styles.descriptionSummary}>
                Descrição do produto
              </summary>
              <p className={styles.descriptionText}>{product.description}</p>
            </details>
          </div>
        </div>

        {/* Reviews section */}
        {product.reviews && product.reviews.length > 0 && (
          <div className={styles.reviewsSection}>
            <h2 className={styles.sectionTitle}>Avaliações</h2>
            <ReviewsList reviews={product.reviews} />
          </div>
        )}

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <section
            aria-label="Peças relacionadas"
            className={styles.relatedSection}
          >
            <h2 className={styles.sectionTitle}>Você também pode gostar</h2>
            <div className={styles.relatedScroll}>
              {relatedProducts.map((p) => (
                <div key={p.id} className={styles.relatedCard}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
