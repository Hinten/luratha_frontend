import { type Product, type Stock, validateProduct, validateStock } from "@/src/schemas/firestore";

function createIsoDate(offsetMinutes: number): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

export function buildMockProducts(): Product[] {
  const createdAt = createIsoDate(-30);
  const updatedAt = createIsoDate(-15);

  return [
    validateProduct({
      id: "prod_mock_vestido_linho",
      title: "Vestido Linho Mock",
      description: "Vestido de linho mock para testes de CRUD no Firestore.",
      isPurchasable: true,
      brandName: "Luratha",
      sku: "LURATHA_100",
      categoryId: "cat_vestidos",
      tags: ["linho", "mock"],
      materialTags: ["linho"],
      seasonalTags: ["verao"],
      price: {
        price: 299,
        priceMin: 299,
        priceMax: 329,
        salePrice: 279,
        currency: "BRL",
      },
      ratingAverage: 4.6,
      reviewCount: 9,
      totalStock: 12,
      status: "active",
      color: ["Bege"],
      variants: [
        {
          id: "var_luratha_101",
          sku: "LURATHA_101",
          size: ["P"],
          color: ["Bege"],
          stock: 12,
          photoIds: [],
          active: true,
        },
      ],
      vectorEmbedding: [0.1, 0.22, 0.39, 0.45, 0.31, 0.17, 0.58, 0.62],
      createdAt,
      updatedAt,
    }),
    validateProduct({
      id: "prod_mock_blusa_linho",
      title: "Blusa Linho Mock",
      description: "Blusa mock para validar leitura em lote no Firestore.",
      isPurchasable: true,
      brandName: "Luratha",
      sku: "LURATHA_200",
      categoryId: "cat_blusas",
      tags: ["blusa", "mock"],
      materialTags: ["linho"],
      seasonalTags: ["meia-estacao"],
      price: {
        price: 199,
        priceMin: 199,
        priceMax: 199,
        currency: "BRL",
      },
      ratingAverage: 4.4,
      reviewCount: 4,
      totalStock: 7,
      status: "active",
      size: ["M"],
      color: ["Off White", "Bege"],
      vectorEmbedding: [0.21, 0.11, 0.35, 0.49, 0.19, 0.28, 0.4, 0.55],
      createdAt,
      updatedAt,
    }),
  ];
}

export function buildMockStock(): Stock[] {
  const updatedAt = createIsoDate(-15);
  const [productWithVariants, productWithoutVariants] = buildMockProducts();

  return [
    validateStock({
      productId: productWithVariants.id,
      sku: productWithVariants.sku,
      quantity: 12,
      hasVariants: true,
      variants: {
        var_luratha_101: 12,
      },
      updatedAt,
    }),
    validateStock({
      productId: productWithoutVariants.id,
      sku: productWithoutVariants.sku,
      quantity: 7,
      hasVariants: false,
      variants: null,
      updatedAt,
    }),
  ];
}
