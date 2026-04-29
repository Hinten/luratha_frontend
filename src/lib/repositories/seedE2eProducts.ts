import { type Product, type Stock, validateProduct, validateStock } from "@/src/schemas/firestore";

/**
 * E2E test product data.
 * Must match the product slugs and data expected in e2e/*.spec.ts
 */
export function buildE2eTestProducts(): Product[] {
  const now = new Date().toISOString();

  return [
    validateProduct({
      id: "prod_e2e_vestido_bordado_floral",
      title: "Vestido Bordado Floral",
      description: "Vestido com bordado floral artesanal para E2E tests.",
      sku: "LURATHA_E2E_001",
      isPurchasable: true,
      brandName: "Luratha",
      categoryId: "cat_vestidos",
      tags: ["vestido", "bordado", "floral"],
      materialTags: [],
      seasonalTags: ["verão"],
      price: {
        price: 329,
        priceMin: 289,
        priceMax: 329,
        salePrice: 289,
        currency: "BRL",
      },
      status: "active",
      totalStock: 12,
      ratingAverage: 4.5,
      reviewCount: 5,
      color: ["Off White"],
      variants: [
        {
          id: "var_luratha_e2e_001_v1",
          sku: "LURATHA_E2E_001_VARIANT",
          size: ["PP", "M", "GG"],
          color: ["Off White"],
          stock: 12,
          photoIds: [
            "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Vestido+Bordado+Floral",
          ],
          active: true,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }),
    validateProduct({
      id: "prod_e2e_conjunto_crochet",
      title: "Conjunto Saia e Blusa Crochet",
      description: "Conjunto artesanal em crochet para E2E tests.",
      sku: "LURATHA_E2E_002",
      isPurchasable: true,
      brandName: "Luratha",
      categoryId: "cat_conjuntos",
      tags: ["conjunto", "crochet"],
      materialTags: [],
      seasonalTags: ["verão"],
      price: {
        price: 419,
        priceMin: 419,
        priceMax: 419,
        currency: "BRL",
      },
      status: "active",
      totalStock: 8,
      ratingAverage: 4.7,
      reviewCount: 3,
      color: ["Terracota"],
      createdAt: now,
      updatedAt: now,
    }),
    validateProduct({
      id: "prod_e2e_moletom_bordado",
      title: "Moletom Bordado Slow Fashion",
      description: "Moletom bordado com toque slow fashion para E2E tests.",
      sku: "LURATHA_E2E_003",
      isPurchasable: true,
      brandName: "Luratha",
      categoryId: "cat_moletons",
      tags: ["moletom", "bordado", "slow-fashion"],
      materialTags: [],
      seasonalTags: ["meia-estação"],
      price: {
        price: 319,
        priceMin: 319,
        priceMax: 319,
        currency: "BRL",
      },
      status: "active",
      totalStock: 7,
      ratingAverage: 4.6,
      reviewCount: 4,
      color: ["Cinza", "Off White"],
      createdAt: now,
      updatedAt: now,
    }),
  ];
}

export function buildE2eTestStock(): Stock[] {
  const now = new Date().toISOString();
  const products = buildE2eTestProducts();
  const [withVariants, withoutVariants1, withoutVariants2] = products;

  return [
    validateStock({
      productId: withVariants.id,
      sku: withVariants.sku,
      quantity: 12,
      hasVariants: true,
      variants: {
        var_luratha_e2e_001_v1: 12,
      },
      updatedAt: now,
    }),
    validateStock({
      productId: withoutVariants1.id,
      sku: withoutVariants1.sku,
      quantity: 8,
      hasVariants: false,
      variants: null,
      updatedAt: now,
    }),
    validateStock({
      productId: withoutVariants2.id,
      sku: withoutVariants2.sku,
      quantity: 7,
      hasVariants: false,
      variants: null,
      updatedAt: now,
    }),
  ];
}
