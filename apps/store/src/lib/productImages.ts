import type { Product, ProductImageAsset } from "@luratha/schemas";

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
    return firstAsset.resolutions.desktop.downloadUrl;
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
    return cardResolution.downloadUrl;
  }

  return firstAsset.resolutions.desktop.downloadUrl;
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

  return product.photoAssets.map((asset, index) => buildGalleryImage(asset, product.title, index));
}

export const productGalleryImageSizes = RESPONSIVE_SIZES;
export const productCardImageSizes = PRODUCT_CARD_FALLBACK_SIZES;

function buildGalleryImage(
  asset: ProductImageAsset,
  productTitle: string,
  index: number,
): ProductGalleryImage {
  const mobile = asset.resolutions.mobile.downloadUrl;
  const tablet = asset.resolutions.tablet.downloadUrl;
  const desktop = asset.resolutions.desktop.downloadUrl;
  const zoom = asset.resolutions.zoom?.downloadUrl ?? null;

  return {
    id: asset.id,
    defaultUrl: desktop,
    alt: asset.alt ?? `${productTitle} — imagem ${index + 1}`,
    srcSet: `${mobile} ${asset.resolutions.mobile.width}w, ${tablet} ${asset.resolutions.tablet.width}w, ${desktop} ${asset.resolutions.desktop.width}w`,
    zoomUrl: zoom,
  };
}

function fallbackGallery(productTitle: string, fallbackUrl: string): ProductGalleryImage[] {
  return [
    {
      id: "fallback-image",
      defaultUrl: fallbackUrl,
      alt: `${productTitle} — imagem 1`,
      srcSet: `${fallbackUrl} 1200w`,
      zoomUrl: null,
    },
  ];
}

function findVariantWithPhotos(
  product: Product,
  predicate: (variant: NonNullable<Product["variants"]>[number]) => boolean,
) {
  return product.variants?.find((variant) => predicate(variant) && variant.photoIds.length > 0) ?? null;
}

function variantAssetsByPhotoIds(product: Product, photoIds: readonly string[]): ProductImageAsset[] {
  const assetById = new Map(product.photoAssets.map((asset) => [asset.id, asset]));
  return photoIds
    .map((id) => assetById.get(id))
    .filter((asset): asset is ProductImageAsset => asset !== undefined);
}

export function getVariantGalleryImages(
  product: Product,
  selectedColor: string | null,
  selectedSize: string | null,
  fallbackUrl: string,
): ProductGalleryImage[] {
  const fallbackToProduct = (): ProductGalleryImage[] => {
    if (product.photoAssets.length === 0) {
      return fallbackGallery(product.title, fallbackUrl);
    }
    return product.photoAssets.map((asset, index) => buildGalleryImage(asset, product.title, index));
  };

  if (!product.variants || product.variants.length === 0) {
    return fallbackToProduct();
  }

  const variantsToAssets = (variant: NonNullable<Product["variants"]>[number]) => {
    const assets = variantAssetsByPhotoIds(product, variant.photoIds);
    if (assets.length === 0) return null;
    return assets.map((asset, index) => buildGalleryImage(asset, product.title, index));
  };

  if (selectedColor && selectedSize) {
    const exact = findVariantWithPhotos(
      product,
      (variant) => (variant.color?.includes(selectedColor) ?? false) && (variant.size?.includes(selectedSize) ?? false),
    );
    if (exact) {
      const images = variantsToAssets(exact);
      if (images) return images;
    }
  }

  if (selectedColor) {
    const colorOnly = findVariantWithPhotos(product, (variant) => variant.color?.includes(selectedColor) ?? false);
    if (colorOnly) {
      const images = variantsToAssets(colorOnly);
      if (images) return images;
    }
  }

  if (!selectedColor && selectedSize) {
    const sizeOnly = findVariantWithPhotos(product, (variant) => variant.size?.includes(selectedSize) ?? false);
    if (sizeOnly) {
      const images = variantsToAssets(sizeOnly);
      if (images) return images;
    }
  }

  if (!selectedColor && !selectedSize) {
    const firstWithPhotos = findVariantWithPhotos(product, () => true);
    if (firstWithPhotos) {
      const images = variantsToAssets(firstWithPhotos);
      if (images) return images;
    }
  }

  return fallbackToProduct();
}

export function getVariantCardImage(
  product: Product,
  variantId: string,
  fallbackUrl: string,
): string {
  const variant = product.variants?.find((v) => v.id === variantId);
  if (!variant || variant.photoIds.length === 0) {
    return fallbackUrl;
  }
  const photoId = variant.photoIds[0];
  const asset = product.photoAssets.find((candidate) => candidate.id === photoId);
  if (!asset) {
    return fallbackUrl;
  }
  const cardResolution = asset.resolutions.card;
  if (cardResolution) {
    return cardResolution.downloadUrl;
  }
  return asset.resolutions.mobile.downloadUrl;
}
