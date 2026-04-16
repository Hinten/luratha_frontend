import type { Product } from "@/src/schemas/firestore";

export type ProductGalleryImage = {
  id: string;
  defaultUrl: string;
  alt: string;
  srcSet: string;
  links: Array<{ label: string; url: string }>;
};

const RESPONSIVE_SIZES = "(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px";

export function getProductPrimaryImage(product: Product, fallbackUrl: string): string {
  const firstAsset = product.photoAssets[0];
  if (firstAsset) {
    return firstAsset.resolutions.desktop.temporaryUrl ?? firstAsset.resolutions.desktop.downloadUrl;
  }

  return fallbackUrl;
}

export function getProductGalleryImages(product: Product, fallbackUrl: string): ProductGalleryImage[] {
  if (product.photoAssets.length === 0) {
    return [{
      id: "fallback-image",
      defaultUrl: fallbackUrl,
      alt: `${product.title} — imagem 1`,
      srcSet: `${fallbackUrl} 1200w`,
      links: [{ label: "Desktop", url: fallbackUrl }],
    }];
  }

  return product.photoAssets.map((asset, index) => {
    const mobile = asset.resolutions.mobile.temporaryUrl ?? asset.resolutions.mobile.downloadUrl;
    const tablet = asset.resolutions.tablet.temporaryUrl ?? asset.resolutions.tablet.downloadUrl;
    const desktop = asset.resolutions.desktop.temporaryUrl ?? asset.resolutions.desktop.downloadUrl;

    return {
      id: asset.id,
      defaultUrl: desktop,
      alt: asset.alt ?? `${product.title} — imagem ${index + 1}`,
      srcSet: `${mobile} ${asset.resolutions.mobile.width}w, ${tablet} ${asset.resolutions.tablet.width}w, ${desktop} ${asset.resolutions.desktop.width}w`,
      links: [
        { label: "Mobile", url: mobile },
        { label: "Tablet", url: tablet },
        { label: "Desktop", url: desktop },
      ],
    };
  });
}

export const productGalleryImageSizes = RESPONSIVE_SIZES;
