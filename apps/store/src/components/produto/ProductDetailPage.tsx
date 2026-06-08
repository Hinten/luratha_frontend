import type { FirestoreCategory, Product as FirestoreProduct, Stock } from "@luratha/schemas";
import Breadcrumb from "@/src/components/Breadcrumb";
import ProductDescription from "@/src/components/produto/ProductDescription";
import ProductVariantView from "@/src/components/produto/ProductVariantView";
import { getVariantGalleryImages } from "@/src/lib/productImages";

const DEFAULT_PRODUCT_IMAGE_URL = "/image_404.png";

interface ProductDetailPageProps {
  product: FirestoreProduct;
  category?: FirestoreCategory | null;
  stock?: Stock | null;
}

export default function ProductDetailPage({ product, category, stock }: ProductDetailPageProps) {
  const categorySlug = category?.slug ?? "outros";
  const categoryLabel = category?.name ?? "Outros";
  const categoryHref = `/categoria/${categorySlug}`;
  const ssrImages = getVariantGalleryImages(product, null, null, DEFAULT_PRODUCT_IMAGE_URL);
  const currentPrice = product.price.salePrice ?? product.price.price;
  const originalPrice = product.price.salePrice ? product.price.price : undefined;
  const highlights = product.productHighlight ?? [];

  const totalQuantity = stock?.quantity ?? product.totalStock;
  const availability =
    totalQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: ssrImages.map((image) => image.defaultUrl),
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

        <ProductVariantView
          product={product}
          stock={stock}
          currentPrice={currentPrice}
          originalPrice={originalPrice}
          highlights={highlights}
          fallbackUrl={DEFAULT_PRODUCT_IMAGE_URL}
        />

        <ProductDescription description={product.description} />
      </div>
    </>
  );
}
