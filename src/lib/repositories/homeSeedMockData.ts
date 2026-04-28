import {
  CategorySchema,
  type FirestoreCategory,
  type Product,
  type Stock,
  validateProduct,
  validateStock,
} from "@/src/schemas/firestore";

type VariantSeed = {
  id: string;
  sku: string;
  size?: string[];
  color?: string[];
};

type ProductSeed = {
  id: string;
  title: string;
  description: string;
  sku: string;
  categorySlug: string;
  tags: string[];
  price: number;
  salePrice?: number;
  stock: number;
  color?: string[];
  variants?: VariantSeed[];
};

/**
 * Per-variant stock quantities for products that have variants.
 * Key: productId → (variantId → quantity).
 * The sum of quantities must equal the product's totalStock.
 */
const VARIANT_STOCK: Record<string, Record<string, number>> = {
  prod_home_11: {
    var_prod11_pp: 3,
    var_prod11_p: 4,
    var_prod11_m: 2,
    var_prod11_g: 0,
  },
  prod_home_12: {
    var_prod12_p: 2,
    var_prod12_m: 2,
    var_prod12_g: 2,
  },
  prod_home_15: {
    var_prod15_p: 0,
    var_prod15_m: 2,
    var_prod15_g: 1,
    var_prod15_gg: 0,
  },
};

function createIsoDate(offsetMinutes: number): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

export function buildHomeSeedCategories(): FirestoreCategory[] {
  return [
    { id: "cat_vestidos", name: "Vestidos", slug: "vestidos" },
    { id: "cat_blusas", name: "Blusas", slug: "blusas" },
    { id: "cat_calcas", name: "Calças", slug: "calcas" },
    { id: "cat_saias", name: "Saias", slug: "saias" },
    { id: "cat_shorts", name: "Shorts", slug: "shorts" },
    { id: "cat_conjuntos", name: "Conjuntos", slug: "conjuntos" },
    { id: "cat_moletons", name: "Moletons", slug: "moletons" },
    { id: "cat_acessorios", name: "Acessórios", slug: "acessorios" },
    { id: "cat_camisas", name: "Camisas", slug: "camisas" },
    { id: "cat_tricots", name: "Tricots", slug: "tricots" },
  ].map((category) => CategorySchema.parse(category));
}

export function buildHomeSeedProducts(categories = buildHomeSeedCategories()): Product[] {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const now = createIsoDate(0);
  const seeds: ProductSeed[] = [
    {
      id: "prod_home_01",
      title: "Vestido Midi Linho Natural",
      description: "Vestido midi artesanal em linho com acabamento delicado.",
      sku: "LURATHA_1001",
      categorySlug: "vestidos",
      tags: ["vestido", "linho"],
      price: 329,
      salePrice: 289,
      stock: 12,
      color: ["Bege", "Off White"],
    },
    {
      id: "prod_home_02",
      title: "Vestido Bordado Brisa",
      description: "Vestido com bordado manual e modelagem leve para o dia a dia.",
      sku: "LURATHA_1002",
      categorySlug: "vestidos",
      tags: ["vestido", "bordado"],
      price: 359,
      stock: 8,
      color: ["Azul Marinho"],
    },
    {
      id: "prod_home_03",
      title: "Blusa Cropped Algodão",
      description: "Blusa cropped artesanal em algodão macio.",
      sku: "LURATHA_1003",
      categorySlug: "blusas",
      tags: ["blusa", "algodao"],
      price: 169,
      stock: 15,
      color: ["Branco", "Preto", "Rosé"],
    },
    {
      id: "prod_home_04",
      title: "Blusa Linho Off White",
      description: "Blusa de linho off white com toque minimalista.",
      sku: "LURATHA_1004",
      categorySlug: "blusas",
      tags: ["blusa", "linho"],
      price: 189,
      salePrice: 169,
      stock: 10,
      color: ["Off White"],
    },
    {
      id: "prod_home_05",
      title: "Calça Wide Leg Artesanal",
      description: "Calça wide leg de caimento fluido e produção em pequena escala.",
      sku: "LURATHA_1005",
      categorySlug: "calcas",
      tags: ["calca", "wide-leg"],
      price: 279,
      stock: 9,
      color: ["Preto", "Caramelo"],
    },
    {
      id: "prod_home_06",
      title: "Saia Midi Plissada",
      description: "Saia midi plissada com acabamento artesanal.",
      sku: "LURATHA_1006",
      categorySlug: "saias",
      tags: ["saia", "plissada"],
      price: 239,
      stock: 11,
      color: ["Verde Sálvia"],
    },
    {
      id: "prod_home_07",
      title: "Conjunto Crochet Verão",
      description: "Conjunto artesanal em crochet para dias quentes.",
      sku: "LURATHA_1007",
      categorySlug: "conjuntos",
      tags: ["conjunto", "crochet"],
      price: 419,
      salePrice: 379,
      stock: 6,
      color: ["Terracota"],
    },
    {
      id: "prod_home_08",
      title: "Moletom Bordado Slow",
      description: "Moletom bordado com toque macio e estilo atemporal.",
      sku: "LURATHA_1008",
      categorySlug: "moletons",
      tags: ["moletom", "bordado"],
      price: 319,
      stock: 7,
      color: ["Cinza", "Off White"],
    },
    {
      id: "prod_home_09",
      title: "Short Linho Texturizado",
      description: "Short de linho texturizado com conforto e versatilidade.",
      sku: "LURATHA_1009",
      categorySlug: "shorts",
      tags: ["short", "linho"],
      price: 179,
      stock: 13,
      color: ["Bege"],
    },
    {
      id: "prod_home_10",
      title: "Bolsa Palha Artesanal",
      description: "Bolsa de palha feita à mão com acabamento premium.",
      sku: "LURATHA_1010",
      categorySlug: "acessorios",
      tags: ["bolsa", "acessorio"],
      price: 199,
      stock: 10,
      color: ["Natural"],
    },
    // ── Products with size variants ────────────────────────────────────────────
    {
      id: "prod_home_11",
      title: "Vestido Festa Tecido Nobre",
      description: "Vestido de festa confeccionado em tecido nobre com acabamento artesanal delicado.",
      sku: "LURATHA_1011",
      categorySlug: "vestidos",
      tags: ["vestido", "festa"],
      price: 379,
      salePrice: 349,
      stock: 9, // pp:3 + p:4 + m:2 + g:0
      color: ["Preto"],
      variants: [
        { id: "var_prod11_pp", sku: "LURATHA_1011_PP", size: ["PP"], color: ["Preto"] },
        { id: "var_prod11_p",  sku: "LURATHA_1011_P",  size: ["P"],  color: ["Preto"] },
        { id: "var_prod11_m",  sku: "LURATHA_1011_M",  size: ["M"],  color: ["Preto"] },
        { id: "var_prod11_g",  sku: "LURATHA_1011_G",  size: ["G"],  color: ["Preto"] },
      ],
    },
    {
      id: "prod_home_12",
      title: "Blusa Manga Longa Linho",
      description: "Blusa de manga longa em linho com modelagem solta e tecido de alta qualidade.",
      sku: "LURATHA_1012",
      categorySlug: "blusas",
      tags: ["blusa", "linho", "manga-longa"],
      price: 199,
      stock: 6, // p:2 + m:2 + g:2
      color: ["Off White"],
      variants: [
        { id: "var_prod12_p", sku: "LURATHA_1012_P", size: ["P"], color: ["Off White"] },
        { id: "var_prod12_m", sku: "LURATHA_1012_M", size: ["M"], color: ["Off White"] },
        { id: "var_prod12_g", sku: "LURATHA_1012_G", size: ["G"], color: ["Off White"] },
      ],
    },
    // ── Out-of-stock product (sem variações) ───────────────────────────────────
    {
      id: "prod_home_13",
      title: "Calça Jeans Slim Artesanal",
      description: "Calça jeans slim com lavagem artesanal e caimento perfeito.",
      sku: "LURATHA_1013",
      categorySlug: "calcas",
      tags: ["calca", "jeans"],
      price: 299,
      stock: 0, // out of stock
      color: ["Azul"],
    },
    // ── Low-stock product (sem variações) ──────────────────────────────────────
    {
      id: "prod_home_14",
      title: "Tricot Básico Off White",
      description: "Tricot básico off white com textura delicada e caimento relaxado.",
      sku: "LURATHA_1014",
      categorySlug: "tricots",
      tags: ["tricot", "basico"],
      price: 229,
      stock: 2, // low stock
      color: ["Off White"],
    },
    // ── Product with variants — mixed availability ─────────────────────────────
    {
      id: "prod_home_15",
      title: "Saia Plissada Colorida",
      description: "Saia plissada com estampa vibrante e tecido leve para o dia a dia.",
      sku: "LURATHA_1015",
      categorySlug: "saias",
      tags: ["saia", "plissada"],
      price: 259,
      stock: 3, // p:0 + m:2 + g:1 + gg:0
      color: ["Rosé", "Verde Sálvia", "Azul", "Bege"],
      variants: [
        { id: "var_prod15_p",  sku: "LURATHA_1015_P",  size: ["P"],  color: ["Rosé"] },
        { id: "var_prod15_m",  sku: "LURATHA_1015_M",  size: ["M"],  color: ["Verde Sálvia"] },
        { id: "var_prod15_g",  sku: "LURATHA_1015_G",  size: ["G"],  color: ["Azul"] },
        { id: "var_prod15_gg", sku: "LURATHA_1015_GG", size: ["GG"], color: ["Bege"] },
      ],
    },
  ];

  return seeds.map((seed, index) => {
    const category = bySlug.get(seed.categorySlug);
    if (!category) {
      throw new Error(`Category "${seed.categorySlug}" not found for seed product "${seed.id}"`);
    }

    const variants = seed.variants?.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size ?? null,
      color: v.color ?? null,
      gtin: null,
      mpn: null,
      item_group_id: null,
      photoIds: ["seed_placeholder"],
      active: true,
    }));

    return validateProduct({
      id: seed.id,
      title: seed.title,
      description: seed.description,
      sku: seed.sku,
      status: "active",
      isPurchasable: true,
      brandName: "Luratha",
      categoryId: category.id,
      tags: seed.tags,
      materialTags: [],
      seasonalTags: ["verão"],
      price: {
        price: seed.price,
        salePrice: seed.salePrice ?? null,
        priceMin: seed.salePrice ?? seed.price,
        priceMax: seed.price,
        currency: "BRL",
      },
      totalStock: seed.stock,
      color: seed.color ?? null,
      ratingAverage: 4.5,
      reviewCount: index + 3,
      vectorEmbedding: [0.13, 0.27, 0.44, 0.35, 0.56, 0.12, 0.67, 0.31],
      searchEmbedding: [0.13, 0.27, 0.44, 0.35, 0.56, 0.12, 0.67, 0.31],
      variants: variants ?? null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

export function buildHomeSeedStock(products = buildHomeSeedProducts()): Stock[] {
  const now = new Date().toISOString();
  return products.map((product) => {
    const variantStockMap = VARIANT_STOCK[product.id];

    if (product.variants && variantStockMap) {
      return validateStock({
        productId: product.id,
        sku: product.sku,
        quantity: product.totalStock,
        hasVariants: true,
        variants: variantStockMap,
        updatedAt: now,
      });
    }

    return validateStock({
      productId: product.id,
      sku: product.sku,
      quantity: product.totalStock,
      hasVariants: false,
      variants: null,
      updatedAt: now,
    });
  });
}
