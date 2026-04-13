import { z } from "zod";

export const firestoreCollections = {
  photos: "photos",
  products: "products",
  carts: "carts",
  cartItems: "items",
  orders: "orders",
  coupons: "coupons",
  userProfiles: "userProfiles",
  reviews: "reviews",
} as const;

const timestampSchema = z.string().datetime({ offset: true });
const nonEmptyStringSchema = z.string().trim().min(1);
const moneySchema = z.number().finite().gt(0);
const quantitySchema = z.number().int().gt(0);
const skuSchema = z.string().trim().regex(/^[A-Z0-9_-]{6,64}$/);
const uidSchema = z.string().trim().min(6).max(128);

export const photoSchema = z.object({
  id: nonEmptyStringSchema,
  storagePath: nonEmptyStringSchema,
  downloadUrl: z.string().url(),
  checksumSha256: z.string().trim().length(64),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: nonEmptyStringSchema,
  colorHex: z.string().regex(/^#([A-Fa-f0-9]{6})$/).optional(),
  tags: z.array(nonEmptyStringSchema).max(25).default([]),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const productVariantSchema = z.object({
  sku: skuSchema,
  size: nonEmptyStringSchema,
  colorName: nonEmptyStringSchema.optional(),
  colorHex: z.string().regex(/^#([A-Fa-f0-9]{6})$/).optional(),
  price: moneySchema,
  compareAtPrice: moneySchema.optional(),
  stock: z.number().int().min(0),
  photoIds: z.array(nonEmptyStringSchema).min(1),
  active: z.boolean().default(true),
});

export const productSchema = z
  .object({
    id: nonEmptyStringSchema,
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    categorySlug: nonEmptyStringSchema,
    subcategorySlug: nonEmptyStringSchema.optional(),
    tags: z.array(nonEmptyStringSchema).max(50).default([]),
    materialTags: z.array(nonEmptyStringSchema).max(20).default([]),
    seasonalTags: z.array(nonEmptyStringSchema).max(20).default([]),
    priceMin: moneySchema,
    priceMax: moneySchema,
    currency: z.literal("BRL"),
    ratingAverage: z.number().min(0).max(5).default(0),
    reviewCount: z.number().int().min(0).default(0),
    totalStock: z.number().int().min(0),
    status: z.enum(["draft", "active", "archived"]),
    photoIds: z.array(nonEmptyStringSchema).min(1),
    primaryPhotoId: nonEmptyStringSchema,
    variants: z.array(productVariantSchema).min(1),
    searchText: nonEmptyStringSchema,
    searchableTokens: z.array(nonEmptyStringSchema).max(200),
    searchEmbedding: z.array(z.number().finite()).max(4096).optional(),
    publishedAt: timestampSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((product, ctx) => {
    if (product.priceMax < product.priceMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceMax"],
        message: "priceMax must be greater than or equal to priceMin",
      });
    }

    if (!product.photoIds.includes(product.primaryPhotoId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryPhotoId"],
        message: "primaryPhotoId must exist in photoIds",
      });
    }

    const variantSkus = new Set<string>();
    for (const variant of product.variants) {
      if (variant.compareAtPrice !== undefined && variant.compareAtPrice <= variant.price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants"],
          message: "compareAtPrice must be greater than variant price when provided",
        });
      }

      if (variantSkus.has(variant.sku)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants"],
          message: "variant SKU must be unique inside the product",
        });
      }
      variantSkus.add(variant.sku);

      const unknownPhoto = variant.photoIds.find((photoId) => !product.photoIds.includes(photoId));
      if (unknownPhoto) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants"],
          message: "all variant photoIds must exist in product photoIds",
        });
      }
    }
  });

export const cartItemSchema = z.object({
  id: nonEmptyStringSchema,
  userId: uidSchema,
  productId: nonEmptyStringSchema,
  variantSku: skuSchema,
  productSlug: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  photoId: nonEmptyStringSchema,
  unitPrice: moneySchema,
  quantity: quantitySchema,
  currency: z.literal("BRL"),
  addedAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const cartSchema = z.object({
  id: uidSchema,
  userId: uidSchema,
  itemCount: z.number().int().min(0),
  subtotal: z.number().finite().min(0),
  couponCode: nonEmptyStringSchema.optional(),
  discountTotal: z.number().finite().min(0).default(0),
  shippingTotal: z.number().finite().min(0).default(0),
  grandTotal: z.number().finite().min(0),
  currency: z.literal("BRL"),
  updatedAt: timestampSchema,
});

export const couponSchema = z
  .object({
    id: nonEmptyStringSchema,
    code: z.string().trim().toUpperCase().min(3).max(32),
    type: z.enum(["percentage", "fixed"]),
    amount: z.number().finite().gt(0),
    maxDiscountAmount: z.number().finite().gt(0).optional(),
    minimumOrderAmount: z.number().finite().min(0).default(0),
    startsAt: timestampSchema,
    expiresAt: timestampSchema,
    usageLimit: z.number().int().positive().optional(),
    usageCount: z.number().int().min(0).default(0),
    active: z.boolean().default(true),
  })
  .superRefine((coupon, ctx) => {
    if (coupon.type === "percentage" && coupon.amount > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "percentage coupon amount must be lower than or equal to 100",
      });
    }

    if (coupon.expiresAt <= coupon.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "expiresAt must be greater than startsAt",
      });
    }
  });

export const orderItemSchema = z.object({
  id: nonEmptyStringSchema,
  productId: nonEmptyStringSchema,
  variantSku: skuSchema,
  name: nonEmptyStringSchema,
  photoId: nonEmptyStringSchema,
  quantity: quantitySchema,
  unitPrice: moneySchema,
  lineTotal: moneySchema,
  currency: z.literal("BRL"),
});

export const shippingAddressSchema = z.object({
  recipientName: nonEmptyStringSchema,
  line1: nonEmptyStringSchema,
  line2: z.string().trim().optional(),
  neighborhood: nonEmptyStringSchema,
  city: nonEmptyStringSchema,
  state: z.string().trim().length(2),
  postalCode: z.string().regex(/^\d{5}-\d{3}$/),
  country: z.literal("BR"),
});

export const orderSchema = z
  .object({
    id: nonEmptyStringSchema,
    userId: uidSchema,
    orderNumber: z.string().trim().regex(/^[A-Z0-9-]{8,32}$/),
    status: z.enum([
      "pending_payment",
      "paid",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
    ]),
    paymentMethod: z.enum(["pix", "credit_card", "boleto"]),
    paymentStatus: z.enum(["pending", "authorized", "paid", "failed", "refunded"]),
    items: z.array(orderItemSchema).min(1),
    itemCount: quantitySchema,
    subtotal: moneySchema,
    discountTotal: z.number().finite().min(0).default(0),
    shippingTotal: z.number().finite().min(0).default(0),
    grandTotal: moneySchema,
    currency: z.literal("BRL"),
    couponCode: nonEmptyStringSchema.optional(),
    shippingAddress: shippingAddressSchema,
    notes: z.string().trim().max(500).optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((order, ctx) => {
    const calculatedItemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    if (calculatedItemCount !== order.itemCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["itemCount"],
        message: "itemCount must match the sum of all item quantities",
      });
    }

    for (const item of order.items) {
      const expectedLineTotal = Number((item.unitPrice * item.quantity).toFixed(2));
      if (Number(item.lineTotal.toFixed(2)) !== expectedLineTotal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items"],
          message: "lineTotal must equal unitPrice multiplied by quantity",
        });
      }
    }

    const expectedGrandTotal = Number(
      (order.subtotal - order.discountTotal + order.shippingTotal).toFixed(2),
    );

    if (Number(order.grandTotal.toFixed(2)) !== expectedGrandTotal || order.grandTotal <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["grandTotal"],
        message: "grandTotal must match subtotal - discountTotal + shippingTotal",
      });
    }
  });

export const reviewSchema = z.object({
  id: nonEmptyStringSchema,
  productId: nonEmptyStringSchema,
  orderId: nonEmptyStringSchema,
  userId: uidSchema,
  rating: z.number().int().min(1).max(5),
  title: nonEmptyStringSchema,
  comment: z.string().trim().min(10).max(1000),
  helpfulCount: z.number().int().min(0).default(0),
  verifiedPurchase: z.boolean().default(true),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const userProfileSchema = z.object({
  id: uidSchema,
  email: z.string().email(),
  firstName: nonEmptyStringSchema,
  lastName: nonEmptyStringSchema,
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  role: z.enum(["customer", "admin"]).default("customer"),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const pipelineSearchRequestSchema = z.object({
  term: nonEmptyStringSchema,
  categorySlug: nonEmptyStringSchema.optional(),
  minPrice: z.number().finite().min(0).optional(),
  maxPrice: z.number().finite().min(0).optional(),
  tags: z.array(nonEmptyStringSchema).max(20).optional(),
  limit: z.number().int().min(1).max(100).default(24),
  offset: z.number().int().min(0).default(0),
});

export const vectorSearchRequestSchema = z.object({
  embedding: z.array(z.number().finite()).min(8).max(4096),
  topK: z.number().int().min(1).max(100).default(20),
  minScore: z.number().finite().min(0).max(1).default(0),
  categorySlug: nonEmptyStringSchema.optional(),
});

export type Photo = z.infer<typeof photoSchema>;
export type ProductVariant = z.infer<typeof productVariantSchema>;
export type Product = z.infer<typeof productSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type Cart = z.infer<typeof cartSchema>;
export type Coupon = z.infer<typeof couponSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
export type Order = z.infer<typeof orderSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type PipelineSearchRequest = z.infer<typeof pipelineSearchRequestSchema>;
export type VectorSearchRequest = z.infer<typeof vectorSearchRequestSchema>;

export function validateProduct(input: unknown): Product {
  return productSchema.parse(input);
}

export function validateCartItem(input: unknown): CartItem {
  return cartItemSchema.parse(input);
}

export function validateOrder(input: unknown): Order {
  return orderSchema.parse(input);
}
