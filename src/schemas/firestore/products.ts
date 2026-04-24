import { z } from "zod";
import {
  colorHexSchema,
  moneySchema,
  nonEmptyStringSchema,
  skuSchema,
  timestampSchema,
} from "@/src/schemas/firestore/utils";

const productSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);


export function slugifyProductPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildProductSlug(name: string, sku: string): string {
  const normalizedName = slugifyProductPart(name);
  const normalizedSku = slugifyProductPart(sku);

  const fallbackName = normalizedName || "produto";
  const fallbackSku = normalizedSku || "sku";
  return `${fallbackName}-${fallbackSku}`;
}


export const priceSchema = z.object({
  price: moneySchema,
  salePrice: moneySchema.nullable().default(null),
  priceMin: moneySchema.nullable().default(null), // utilizado para automação de preços em produtos variáveis
  priceMax: moneySchema.nullable().default(null), // utilizado para automação de preços em produtos variáveis
  currency: z.literal("BRL"),
  startDate: timestampSchema.nullable().default(null),
  endDate: timestampSchema.nullable().default(null),
}).superRefine((price, ctx) => {  if ((price.priceMax && price.priceMin) && price.priceMax < price.priceMin) {
    ctx.addIssue({
      code: "custom",
      path: ["priceMax"],
      message: "priceMax must be greater than or equal to priceMin",
    });
  }

  if (price.salePrice !== null) {
    if (price.salePrice >= price.price) {
      ctx.addIssue({
        code: "custom",
        path: ["salePrice"],
        message: "salePrice must be less than price",
      });
    }
  }

});

export const dimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.enum(["cm", "in"]).default("cm"),
  weightKg: z.number().positive().nullable().default(null),
  weightGrossKg: z.number().positive().nullable().default(null),
});

export const productDetailsSchema = z.object({
  section_name: nonEmptyStringSchema.max(140),
  attribute_name: nonEmptyStringSchema.max(140),
  attribute_value: nonEmptyStringSchema.max(1000),
});

export const productVariantSchema = z.object({
  sku: skuSchema,
  gtin: z.string().trim().regex(/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/).nullable().default(null),
  mpn: nonEmptyStringSchema.nullable().default(null),
  // acho que vou usar o sku do pai mesmo
  item_group_id: nonEmptyStringSchema.nullable().default(null), // utilizado para agrupar variantes em feeds de produtos, deve ser igual para variantes do mesmo produto  
  color: z.array(nonEmptyStringSchema).nullable().default(null),
  size: z.array(nonEmptyStringSchema).nullable().default(null),

  stock: z.number().int().min(0),
  photoIds: z.array(nonEmptyStringSchema).min(1),
  active: z.boolean().default(true),
  
});

const productImageResolutionSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  storagePath: nonEmptyStringSchema,
  downloadUrl: z.url(),
  temporaryUrl: z.url().nullable().default(null),
  format: z.literal("webp").default("webp"),
});

export const productImageAssetSchema = z.object({
  id: nonEmptyStringSchema.max(120),
  alt: nonEmptyStringSchema.max(300).nullable().default(null),
  resolutions: z.object({
    card: productImageResolutionSchema.optional(),
    zoom: productImageResolutionSchema.optional(),
    mobile: productImageResolutionSchema,
    tablet: productImageResolutionSchema,
    desktop: productImageResolutionSchema,
  }),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
//https://support.google.com/merchants/answer/7052112?hl=en
const productSchemaBase = z
  .preprocess((input) => {
    if (!input || typeof input !== "object") {
      return input;
    }

    const parsedInput = input as Record<string, unknown>;
    const hasSlug = typeof parsedInput.slug === "string" && parsedInput.slug.trim().length > 0;
    const hasName = typeof parsedInput.title === "string";
    const hasSku = typeof parsedInput.sku === "string";

    if (hasSlug || !hasName || !hasSku) {
      return input;
    }

    return {
      ...parsedInput,
      slug: buildProductSlug(parsedInput.title as string, parsedInput.sku as string),
    };
  },
  z.object({
    id: nonEmptyStringSchema.max(50),
    slug: productSlugSchema.nullable().default(null),
    title: nonEmptyStringSchema.max(150),
    shortTitle: nonEmptyStringSchema.min(5).max(65).nullable().default(null),
    description: nonEmptyStringSchema.max(5000),
    
    vectorEmbedding: z.array(z.number().finite()).min(8).max(2048).nullable().default(null),
    searchEmbedding: z.array(z.number().finite()).min(8).max(2048).nullable().default(null),

    sku: skuSchema,
    gtin: z.string().trim().regex(/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/).nullable().default(null),
    mpn: nonEmptyStringSchema.nullable().default(null),
    status: z.enum(["draft", "active", "archived"]),

    // productType: z.enum(["simple", "variable"]).default("simple"), // ver se é necessário colocar isso
    // schemaIntent: z.enum(["merchant_listing", "product_snippet"]).default("merchant_listing"),
    isPurchasable: z.boolean().default(true),
    brandName: nonEmptyStringSchema.default("Luratha"),
    categoryId: nonEmptyStringSchema.max(50),
    googleProductCategoryId: z.string().trim().nullable().default(null), // https://support.google.com/merchants/answer/6324436?visit_id=639118635357846475-888363973&rd=1
    tags: z.array(nonEmptyStringSchema).max(50).default([]),
    materialTags: z.array(nonEmptyStringSchema).max(20).default([]),
    seasonalTags: z.array(nonEmptyStringSchema).max(20).default([]),
    price: priceSchema,
    salePrice: priceSchema.nullable().default(null),
    condition: z.enum(["new", "used", "refurbished"]).default("new"),
    adult: z.boolean().default(false), // Indica se o produto contém nudez ou conteúdo adulto
    isBundle: z.boolean().default(false), // Indica se o produto é um bundle de múltiplos itens
    multipack: z.number().int().min(1).default(1), // Quantidade de itens em um bundle, se isBundle for true

    age_group: z.enum(["newborn", "infant", "toddler", "kids", "adult"]).nullable().default(null),
    gender: z.enum(["male", "female", "unisex"]).nullable().default(null),
    color: z.array(nonEmptyStringSchema).nullable().default(null),
    size: z.array(nonEmptyStringSchema).nullable().default(null),
    sizeType: z.enum([
      "regular", 
      "petite", 
      "maternity",
      "big",
      "tall",
      "plus"
    ]).nullable().default(null),
    sizeSystem: z.enum([
      "US",
      "UK",
      "EU",
      "DE",
      "FR",
      "JP",
      "CN",
      "IT",
      "BR",
      "MEX",
      "AU",
    ]).nullable().default(null),
    material: z.array(nonEmptyStringSchema).default([]),
    pattern: z.array(nonEmptyStringSchema).default([]),
    dimensions: dimensionsSchema.nullable().default(null),

    productDetail: z.array(productDetailsSchema).nullable().default(null),
    productHighlight: z.array(nonEmptyStringSchema.max(150)).min(2).max(100).nullable().default(null),
    
    photoAssets: z.array(productImageAssetSchema).default([]),
    lifeStylePhotos: z.array(productImageAssetSchema).default([]),
    videoUrls: z.array(z.url()).default([]),

    // shipping verificar se é possível usar isso no brasil https://support.google.com/merchants/answer/6324484?visit_id=639118635357846475-888363973&rd=1
    // carrier_shipping implementarhttps://support.google.com/merchants/answer/15449142

    ratingAverage: z.number().min(0).max(5).nullable().default(null),
    reviewCount: z.number().int().min(0).nullable().default(null),
    totalStock: z.number().int().default(0),

    variants: z.array(productVariantSchema).nullable().default(null),

    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((product, ctx) => {

    const sameSkuInVariants = product.variants?.some((variant) => variant.sku === product.sku);
    if (sameSkuInVariants) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "variant SKU must be unique inside the product",
      });
    }

    const expectedSlug = buildProductSlug(product.title, product.sku);
    if (product.slug && product.slug !== expectedSlug) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: "slug must match the generated value based on title and sku",
      });
    }
  }));

export const productSchema = productSchemaBase.transform((product) => {
  const generatedSlug = buildProductSlug(product.title, product.sku);
  const vectorEmbedding = product.vectorEmbedding ?? product.searchEmbedding;

  return {
    ...product,
    slug: generatedSlug,
    vectorEmbedding,
  };
});

export type ProductVariant = z.infer<typeof productVariantSchema>;
export type ProductImageAsset = z.infer<typeof productImageAssetSchema>;
export type Product = z.infer<typeof productSchema>;

export function validateProduct(input: unknown): Product {
  return productSchema.parse(input);
}
