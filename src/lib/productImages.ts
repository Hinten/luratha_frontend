import type { Product } from "@/src/schemas/firestore";

export type ProductGalleryImage = {
  id: string;
  defaultUrl: string;
  alt: string;
  srcSet: string;
  zoomUrl: string | null;
};

const RESPONSIVE_SIZES = "(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px";
const PRODUCT_CARD_FALLBACK_SIZES = "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw";

export function getProductPrimaryImage(product: Product, fallbackUrl: string): string {
  const firstAsset = product.photoAssets[0];
  if (firstAsset) {
    return resolvePreferredUrl(firstAsset.resolutions.desktop.downloadUrl, firstAsset.resolutions.desktop.temporaryUrl);
  }

  return fallbackUrl;
}

export function getProductCardImage(product: Product, fallbackUrl: string): string {
  const firstAsset = product.photoAssets[0];
  if (!firstAsset) {
    return fallbackUrl;
  }

  const cardResolution = firstAsset.resolutions.card;
  if (cardResolution) {
    return resolvePreferredUrl(cardResolution.downloadUrl, cardResolution.temporaryUrl);
  }

  return resolvePreferredUrl(firstAsset.resolutions.desktop.downloadUrl, firstAsset.resolutions.desktop.temporaryUrl);
}

export function getProductGalleryImages(product: Product, fallbackUrl: string): ProductGalleryImage[] {
  if (product.photoAssets.length === 0) {
    return [{
      id: "fallback-image",
      defaultUrl: fallbackUrl,
      alt: `${product.title} — imagem 1`,
      srcSet: `${fallbackUrl} 1200w`,
      zoomUrl: null,
    }];
  }

  return product.photoAssets.map((asset, index) => {
    const mobile = asset.resolutions.mobile.temporaryUrl ?? asset.resolutions.mobile.downloadUrl;
    const tablet = asset.resolutions.tablet.temporaryUrl ?? asset.resolutions.tablet.downloadUrl;
    const desktop = asset.resolutions.desktop.temporaryUrl ?? asset.resolutions.desktop.downloadUrl;
    const zoom = asset.resolutions.zoom
      ? asset.resolutions.zoom.temporaryUrl ?? asset.resolutions.zoom.downloadUrl
      : null;

    return {
      id: asset.id,
      defaultUrl: desktop,
      alt: asset.alt ?? `${product.title} — imagem ${index + 1}`,
      srcSet: `${mobile} ${asset.resolutions.mobile.width}w, ${tablet} ${asset.resolutions.tablet.width}w, ${desktop} ${asset.resolutions.desktop.width}w`,
      zoomUrl: zoom,
    };
  });
}

export const productGalleryImageSizes = RESPONSIVE_SIZES;
export const productCardImageSizes = PRODUCT_CARD_FALLBACK_SIZES;

function resolvePreferredUrl(downloadUrl: string, temporaryUrl: string | null): string {
  return temporaryUrl ?? downloadUrl;
}
