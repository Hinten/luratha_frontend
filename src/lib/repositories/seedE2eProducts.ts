import { type Product, validateProduct } from "@/src/schemas/firestore";

/**
 * E2E test product data.
 * Must match the product slugs and data expected in e2e/with-emulator/*.spec.ts
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
      category: [{ id: "cat_vestidos", name: "Vestidos", slug: "vestidos" }],
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
      photoIds: [
        "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Vestido+Bordado+Floral",
        "https://placehold.co/600x750/D9D2C7/3A2F2A?text=Vestido+Detalhe",
      ],
      variants: [
        {
          sku: "LURATHA_E2E_001_VARIANT",
          size: ["PP", "M", "GG"],
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
      category: [{ id: "cat_conjuntos", name: "Conjuntos", slug: "conjuntos" }],
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
      photoIds: [
        "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Conjunto+Crochet",
      ],
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
      category: [{ id: "cat_moletons", name: "Moletons", slug: "moletons" }],
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
      photoIds: [
        "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Moletom+Bordado",
      ],
      createdAt: now,
      updatedAt: now,
    }),
  ];
}
