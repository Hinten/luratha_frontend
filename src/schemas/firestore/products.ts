import { z } from "zod";
import {
  colorHexSchema,
  moneySchema,
  nonEmptyStringSchema,
  skuSchema,
  timestampSchema,
} from "@/src/schemas/firestore/utils";
import { CategorySchema } from "./category";

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
  salePrice: moneySchema.optional(),
  priceMin: moneySchema, // utilizado para automação de preços em produtos variáveis
  priceMax: moneySchema, // utilizado para automação de preços em produtos variáveis
  currency: z.literal("BRL"),
  startDate: timestampSchema.optional(),
  endDate: timestampSchema.optional(),
}).superRefine((price, ctx) => {  if (price.priceMax < price.priceMin) {
    ctx.addIssue({
      code: "custom",
      path: ["priceMax"],
      message: "priceMax must be greater than or equal to priceMin",
    });
  }

  if (price.salePrice !== undefined) {
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
  weightKg: z.number().positive().optional(),
  weightGrossKg: z.number().positive().optional(),
});

export const productDetailsSchema = z.object({
  section_name: nonEmptyStringSchema.max(140),
  attribute_name: nonEmptyStringSchema.max(140),
  attribute_value: nonEmptyStringSchema.max(1000),
});

export const productVariantSchema = z.object({
  sku: skuSchema,
  gtin: z.string().trim().regex(/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/).optional(),
  mpn: nonEmptyStringSchema.optional(),
  // acho que vou usar o sku do pai mesmo
  item_group_id: nonEmptyStringSchema.optional(), // utilizado para agrupar variantes em feeds de produtos, deve ser igual para variantes do mesmo produto  
  color: z.array(nonEmptyStringSchema).optional(),
  size: z.array(nonEmptyStringSchema).optional(),

  stock: z.number().int().min(0),
  photoIds: z.array(nonEmptyStringSchema).min(1),
  active: z.boolean().default(true),
  
});
//https://support.google.com/merchants/answer/7052112?hl=en
const productSchemaBase = z
  .object({
    id: nonEmptyStringSchema.max(50),
    slug: productSlugSchema.optional(),
    title: nonEmptyStringSchema.max(150),
    shortTitle: nonEmptyStringSchema.min(5).max(65).optional(),
    description: nonEmptyStringSchema.max(5000),
    
    vectorEmbedding: z.array(z.number().finite()).min(8).max(4096).optional(),
    searchEmbedding: z.array(z.number().finite()).min(8).max(4096).optional(),

    sku: skuSchema,
    gtin: z.string().trim().regex(/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/).optional(),
    mpn: nonEmptyStringSchema.optional(),
    status: z.enum(["draft", "active", "archived"]),

    // productType: z.enum(["simple", "variable"]).default("simple"), // ver se é necessário colocar isso
    // schemaIntent: z.enum(["merchant_listing", "product_snippet"]).default("merchant_listing"),
    isPurchasable: z.boolean().default(true),
    brandName: nonEmptyStringSchema.default("Luratha"),
    category: z.array(CategorySchema).default([]),
    googleProductCategoryId: z.string().trim().optional(), // https://support.google.com/merchants/answer/6324436?visit_id=639118635357846475-888363973&rd=1
    tags: z.array(nonEmptyStringSchema).max(50).default([]),
    materialTags: z.array(nonEmptyStringSchema).max(20).default([]),
    seasonalTags: z.array(nonEmptyStringSchema).max(20).default([]),
    price: priceSchema,
    salePrice: priceSchema.optional(),
    condition: z.enum(["new", "used", "refurbished"]).default("new"),
    adult: z.boolean().default(false), // Indica se o produto contém nudez ou conteúdo adulto
    isBundle: z.boolean().default(false), // Indica se o produto é um bundle de múltiplos itens
    multipack: z.number().int().min(1).default(1), // Quantidade de itens em um bundle, se isBundle for true

    age_group: z.enum(["newborn", "infant", "toddler", "kids", "adult"]).optional(),
    gender: z.enum(["male", "female", "unisex"]).optional(),
    color: z.array(nonEmptyStringSchema).optional(),
    size: z.array(nonEmptyStringSchema).optional(),
    sizeType: z.enum([
      "regular", 
      "petite", 
      "maternity",
      "big",
      "tall",
      "plus"
    ]).optional(),
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
    ]).optional(),
    material: z.array(nonEmptyStringSchema).default([]),
    pattern: z.array(nonEmptyStringSchema).default([]),
    dimensions: dimensionsSchema.optional(),

    productDetail: z.array(productDetailsSchema).optional(),
    productHighlight: z.array(nonEmptyStringSchema.max(150)).min(2).max(100).optional(),
    
    photoIds: z.array(nonEmptyStringSchema),
    lifeStylePhotoIds: z.array(nonEmptyStringSchema).optional(),
    videoUrls: z.array(z.url()).default([]),

    // shipping verificar se é possível usar isso no brasil https://support.google.com/merchants/answer/6324484?visit_id=639118635357846475-888363973&rd=1
    // carrier_shipping implementarhttps://support.google.com/merchants/answer/15449142

    ratingAverage: z.number().min(0).max(5).optional(),
    reviewCount: z.number().int().min(0).optional(),
    totalStock: z.number().int().default(0),

    variants: z.array(productVariantSchema).optional(),

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
  });

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
export type Product = z.infer<typeof productSchema>;

export function validateProduct(input: unknown): Product {
  return productSchema.parse(input);
}
