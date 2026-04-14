import { type Product, validateProduct } from "@/src/schemas/firestore";

function createIsoDate(offsetMinutes: number): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

export function buildMockProducts(): Product[] {
  const createdAt = createIsoDate(-30);
  const updatedAt = createIsoDate(-15);
  const publishedAt = createIsoDate(-10);

  return [
    validateProduct({
      id: "prod_mock_vestido_linho",
      name: "Vestido Linho Mock",
      description: "Vestido de linho mock para testes de CRUD no Firestore.",
      productType: "simple",
      schemaIntent: "merchant_listing",
      isPurchasable: true,
      brandName: "Luratha",
      identifier: {
        type: "sku",
        value: "LURATHA-100",
      },
      categorySlug: "vestidos",
      tags: ["linho", "mock"],
      materialTags: ["linho"],
      seasonalTags: ["verao"],
      priceMin: 299,
      priceMax: 299,
      currency: "BRL",
      ratingAverage: 4.6,
      reviewCount: 9,
      totalStock: 12,
      status: "active",
      photoIds: ["photo_mock_vestido_1"],
      primaryPhotoId: "photo_mock_vestido_1",
      defaultVariantSku: "LURATHA-100",
      variantAxes: [],
      variants: [
        {
          sku: "LURATHA-100",
          size: "M",
          attributes: { size: "M" },
          price: 299,
          stock: 12,
          photoIds: ["photo_mock_vestido_1"],
          availability: "InStock",
          itemCondition: "NewCondition",
          active: true,
        },
      ],
      searchText: "vestido linho mock testes",
      searchableTokens: ["vestido", "linho", "mock", "testes"],
      vectorEmbedding: [0.1, 0.22, 0.39, 0.45, 0.31, 0.17, 0.58, 0.62],
      publishedAt,
      createdAt,
      updatedAt,
    }),
    validateProduct({
      id: "prod_mock_blusa_linho",
      name: "Blusa Linho Mock",
      description: "Blusa mock para validar leitura em lote no Firestore.",
      productType: "simple",
      schemaIntent: "merchant_listing",
      isPurchasable: true,
      brandName: "Luratha",
      identifier: {
        type: "sku",
        value: "LURATHA-200",
      },
      categorySlug: "blusas",
      tags: ["blusa", "mock"],
      materialTags: ["linho"],
      seasonalTags: ["meia-estacao"],
      priceMin: 199,
      priceMax: 199,
      currency: "BRL",
      ratingAverage: 4.4,
      reviewCount: 4,
      totalStock: 7,
      status: "active",
      photoIds: ["photo_mock_blusa_1"],
      primaryPhotoId: "photo_mock_blusa_1",
      defaultVariantSku: "LURATHA-200",
      variantAxes: [],
      variants: [
        {
          sku: "LURATHA-200",
          size: "P",
          attributes: { size: "P" },
          price: 199,
          stock: 7,
          photoIds: ["photo_mock_blusa_1"],
          availability: "InStock",
          itemCondition: "NewCondition",
          active: true,
        },
      ],
      searchText: "blusa linho mock leitura",
      searchableTokens: ["blusa", "linho", "mock", "leitura"],
      vectorEmbedding: [0.21, 0.11, 0.35, 0.49, 0.19, 0.28, 0.4, 0.55],
      publishedAt,
      createdAt,
      updatedAt,
    }),
  ];
}
