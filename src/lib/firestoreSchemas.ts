export const FIRESTORE_COLLECTIONS = {
  products: "products",
  photoAssets: "photoAssets",
  carts: "carts",
  orders: "orders",
  categories: "categories",
  inventory: "inventory",
} as const;

export type ProductStatus = "draft" | "active" | "archived";
export type CurrencyCode = "BRL";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

export interface PhotoAssetSchema {
  id: string;
  storagePath: string;
  bucket: string;
  contentType: string;
  width: number;
  height: number;
  sizeBytes: number;
  alt: string;
  hash: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariantSchema {
  id: string;
  sku: string;
  size: string;
  color?: string;
  priceCents: number;
  compareAtPriceCents?: number;
  stockQty: number;
  active: boolean;
}

export interface ProductSchema {
  id: string;
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  status: ProductStatus;
  currency: CurrencyCode;
  photoIds: string[];
  primaryPhotoId: string;
  variants: ProductVariantSchema[];
  minPriceCents: number;
  maxPriceCents: number;
  totalStock: number;
  ratingAvg?: number;
  ratingCount?: number;
  searchText: string;
  searchTokens: string[];
  searchVector?: number[];
  vectorModel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItemSchema {
  productId: string;
  variantId: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  photoIdSnapshot?: string;
  productNameSnapshot: string;
}

export interface CartSchema {
  id: string;
  customerId: string;
  currency: CurrencyCode;
  items: CartItemSchema[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  updatedAt: string;
  createdAt: string;
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "shipping"
  | "delivered"
  | "cancelled";

export interface AddressSchema {
  recipient: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface OrderSchema {
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  currency: CurrencyCode;
  items: CartItemSchema[];
  shippingAddress: AddressSchema;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategorySchema {
  id: string;
  slug: string;
  label: string;
  active: boolean;
}

export interface InventorySchema {
  sku: string;
  availableQty: number;
  reservedQty: number;
  updatedAt: string;
}

export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchTokens(...values: string[]): string[] {
  const normalized = normalizeSearchText(values.join(" "));
  if (!normalized) {
    return [];
  }

  return Array.from(new Set(normalized.split(" ").filter(Boolean)));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asValidationResult<T>(errors: string[], data: T): ValidationResult<T> {
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data };
}

function requireNonEmptyString(
  source: Record<string, unknown>,
  field: string,
  errors: string[]
): string {
  const value = source[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string`);
    return "";
  }

  return value;
}

function requirePositiveInt(
  source: Record<string, unknown>,
  field: string,
  errors: string[]
): number {
  const value = source[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    errors.push(`${field} must be an integer > 0`);
    return 0;
  }

  return value;
}

function requireNonNegativeInt(
  source: Record<string, unknown>,
  field: string,
  errors: string[]
): number {
  const value = source[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    errors.push(`${field} must be an integer >= 0`);
    return 0;
  }

  return value;
}

export function validatePhotoAsset(
  input: unknown
): ValidationResult<PhotoAssetSchema> {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ["photoAsset must be an object"] };
  }

  const id = requireNonEmptyString(input, "id", errors);
  const storagePath = requireNonEmptyString(input, "storagePath", errors);
  const bucket = requireNonEmptyString(input, "bucket", errors);
  const contentType = requireNonEmptyString(input, "contentType", errors);
  const width = requirePositiveInt(input, "width", errors);
  const height = requirePositiveInt(input, "height", errors);
  const sizeBytes = requirePositiveInt(input, "sizeBytes", errors);
  const alt = requireNonEmptyString(input, "alt", errors);
  const hash = requireNonEmptyString(input, "hash", errors);
  const createdAt = requireNonEmptyString(input, "createdAt", errors);
  const updatedAt = requireNonEmptyString(input, "updatedAt", errors);

  if (!contentType.startsWith("image/")) {
    errors.push("contentType must start with image/");
  }

  const rawTags = input.tags;
  const tags = Array.isArray(rawTags) ? rawTags : [];
  if (!Array.isArray(rawTags) || tags.some((tag) => typeof tag !== "string")) {
    errors.push("tags must be an array of strings");
  }

  return asValidationResult(errors, {
    id,
    storagePath,
    bucket,
    contentType,
    width,
    height,
    sizeBytes,
    alt,
    hash,
    tags: tags as string[],
    createdAt,
    updatedAt,
  });
}

export function validateProduct(input: unknown): ValidationResult<ProductSchema> {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ["product must be an object"] };
  }

  const id = requireNonEmptyString(input, "id", errors);
  const slug = requireNonEmptyString(input, "slug", errors);
  const name = requireNonEmptyString(input, "name", errors);
  const description = requireNonEmptyString(input, "description", errors);
  const categorySlug = requireNonEmptyString(input, "categorySlug", errors);
  const currency = requireNonEmptyString(input, "currency", errors);
  const status = requireNonEmptyString(input, "status", errors);
  const primaryPhotoId = requireNonEmptyString(input, "primaryPhotoId", errors);
  const minPriceCents = requirePositiveInt(input, "minPriceCents", errors);
  const maxPriceCents = requirePositiveInt(input, "maxPriceCents", errors);
  const totalStock = requireNonNegativeInt(input, "totalStock", errors);
  const searchText = requireNonEmptyString(input, "searchText", errors);
  const createdAt = requireNonEmptyString(input, "createdAt", errors);
  const updatedAt = requireNonEmptyString(input, "updatedAt", errors);

  if (currency !== "BRL") {
    errors.push("currency must be BRL");
  }

  if (!["draft", "active", "archived"].includes(status)) {
    errors.push("status must be draft, active, or archived");
  }

  if (minPriceCents > maxPriceCents) {
    errors.push("minPriceCents must be <= maxPriceCents");
  }

  const photoIds = Array.isArray(input.photoIds) ? input.photoIds : [];
  if (photoIds.length === 0 || photoIds.some((value) => typeof value !== "string")) {
    errors.push("photoIds must be a non-empty array of strings");
  }

  if (!photoIds.includes(primaryPhotoId)) {
    errors.push("primaryPhotoId must exist in photoIds");
  }

  const searchTokens = Array.isArray(input.searchTokens) ? input.searchTokens : [];
  if (
    searchTokens.length === 0 ||
    searchTokens.some((value) => typeof value !== "string" || value.length === 0)
  ) {
    errors.push("searchTokens must be a non-empty array of strings");
  }

  const vector = input.searchVector;
  if (vector !== undefined) {
    if (
      !Array.isArray(vector) ||
      vector.length === 0 ||
      vector.some((item) => typeof item !== "number" || !Number.isFinite(item))
    ) {
      errors.push("searchVector must be an array of finite numbers when provided");
    }

    if (typeof input.vectorModel !== "string" || input.vectorModel.trim().length === 0) {
      errors.push("vectorModel must be a non-empty string when searchVector is provided");
    }
  }

  const variantsRaw = input.variants;
  const variants = Array.isArray(variantsRaw) ? variantsRaw : [];
  if (variants.length === 0) {
    errors.push("variants must be a non-empty array");
  }

  variants.forEach((variant, index) => {
    if (!isObject(variant)) {
      errors.push(`variants[${index}] must be an object`);
      return;
    }

    const variantErrors: string[] = [];
    const variantId = requireNonEmptyString(variant, "id", variantErrors);
    const sku = requireNonEmptyString(variant, "sku", variantErrors);
    const size = requireNonEmptyString(variant, "size", variantErrors);
    const priceCents = requirePositiveInt(variant, "priceCents", variantErrors);
    const stockQty = requireNonNegativeInt(variant, "stockQty", variantErrors);

    if (typeof variant.active !== "boolean") {
      variantErrors.push("active must be boolean");
    }

    if (variantErrors.length > 0) {
      errors.push(`variants[${index}] invalid: ${variantErrors.join(", ")}`);
      return;
    }

    if (!variantId || !sku || !size || priceCents <= 0 || stockQty < 0) {
      errors.push(`variants[${index}] has invalid required fields`);
    }
  });

  return asValidationResult(errors, {
    id,
    slug,
    name,
    description,
    categorySlug,
    status: status as ProductStatus,
    currency: "BRL",
    photoIds: photoIds as string[],
    primaryPhotoId,
    variants: variants as ProductVariantSchema[],
    minPriceCents,
    maxPriceCents,
    totalStock,
    ratingAvg:
      typeof input.ratingAvg === "number" && Number.isFinite(input.ratingAvg)
        ? input.ratingAvg
        : undefined,
    ratingCount:
      typeof input.ratingCount === "number" && Number.isInteger(input.ratingCount)
        ? input.ratingCount
        : undefined,
    searchText,
    searchTokens: searchTokens as string[],
    searchVector: Array.isArray(vector) ? (vector as number[]) : undefined,
    vectorModel: typeof input.vectorModel === "string" ? input.vectorModel : undefined,
    createdAt,
    updatedAt,
  });
}

function validateCartLikeInput(
  input: unknown,
  kind: "cart" | "order"
): ValidationResult<
  Omit<CartSchema, "id"> & {
    id?: string;
    orderNumber?: string;
    status?: OrderStatus;
    shippingAddress?: AddressSchema;
  }
> {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: [`${kind} must be an object`] };
  }

  const customerId = requireNonEmptyString(input, "customerId", errors);
  const currency = requireNonEmptyString(input, "currency", errors);
  const subtotalCents = requireNonNegativeInt(input, "subtotalCents", errors);
  const discountCents = requireNonNegativeInt(input, "discountCents", errors);
  const shippingCents = requireNonNegativeInt(input, "shippingCents", errors);
  const totalCents = requireNonNegativeInt(input, "totalCents", errors);
  const createdAt = requireNonEmptyString(input, "createdAt", errors);
  const updatedAt = requireNonEmptyString(input, "updatedAt", errors);

  if (currency !== "BRL") {
    errors.push("currency must be BRL");
  }

  const itemsRaw = input.items;
  const items = Array.isArray(itemsRaw) ? itemsRaw : [];

  if (items.length === 0) {
    errors.push("items must be a non-empty array");
  }

  let computedSubtotal = 0;

  items.forEach((item, index) => {
    if (!isObject(item)) {
      errors.push(`items[${index}] must be an object`);
      return;
    }

    const itemErrors: string[] = [];
    requireNonEmptyString(item, "productId", itemErrors);
    requireNonEmptyString(item, "variantId", itemErrors);
    requireNonEmptyString(item, "sku", itemErrors);
    requireNonEmptyString(item, "productNameSnapshot", itemErrors);

    const quantity = requirePositiveInt(item, "quantity", itemErrors);
    const unitPriceCents = requirePositiveInt(item, "unitPriceCents", itemErrors);
    const lineTotalCents = requirePositiveInt(item, "lineTotalCents", itemErrors);

    if (quantity * unitPriceCents !== lineTotalCents) {
      itemErrors.push("lineTotalCents must equal quantity * unitPriceCents");
    }

    computedSubtotal += lineTotalCents;

    if (itemErrors.length > 0) {
      errors.push(`items[${index}] invalid: ${itemErrors.join(", ")}`);
    }
  });

  if (discountCents > subtotalCents) {
    errors.push("discountCents cannot be greater than subtotalCents");
  }

  if (computedSubtotal !== subtotalCents) {
    errors.push("subtotalCents must match the sum of item line totals");
  }

  if (subtotalCents - discountCents + shippingCents !== totalCents) {
    errors.push("totalCents must be subtotalCents - discountCents + shippingCents");
  }

  return asValidationResult(errors, {
    customerId,
    currency: "BRL",
    items: items as CartItemSchema[],
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents,
    createdAt,
    updatedAt,
  });
}

export function validateCart(input: unknown): ValidationResult<CartSchema> {
  const base = validateCartLikeInput(input, "cart");

  if (!base.ok) {
    return base;
  }

  if (!isObject(input)) {
    return { ok: false, errors: ["cart must be an object"] };
  }

  const errors: string[] = [];
  const id = requireNonEmptyString(input, "id", errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: { id, ...base.data } };
}

export function validateOrder(input: unknown): ValidationResult<OrderSchema> {
  const base = validateCartLikeInput(input, "order");

  if (!base.ok) {
    return base;
  }

  if (!isObject(input)) {
    return { ok: false, errors: ["order must be an object"] };
  }

  const errors: string[] = [];
  const id = requireNonEmptyString(input, "id", errors);
  const orderNumber = requireNonEmptyString(input, "orderNumber", errors);
  const status = requireNonEmptyString(input, "status", errors);

  if (!["pending", "paid", "shipping", "delivered", "cancelled"].includes(status)) {
    errors.push("status must be pending, paid, shipping, delivered, or cancelled");
  }

  const shippingAddress = input.shippingAddress;
  if (!isObject(shippingAddress)) {
    errors.push("shippingAddress must be an object");
  }

  const shippingAddressErrors: string[] = [];
  const addressObj = isObject(shippingAddress) ? shippingAddress : {};
  const recipient = requireNonEmptyString(addressObj, "recipient", shippingAddressErrors);
  const street = requireNonEmptyString(addressObj, "street", shippingAddressErrors);
  const number = requireNonEmptyString(addressObj, "number", shippingAddressErrors);
  const neighborhood = requireNonEmptyString(addressObj, "neighborhood", shippingAddressErrors);
  const city = requireNonEmptyString(addressObj, "city", shippingAddressErrors);
  const state = requireNonEmptyString(addressObj, "state", shippingAddressErrors);
  const zipCode = requireNonEmptyString(addressObj, "zipCode", shippingAddressErrors);
  const country = requireNonEmptyString(addressObj, "country", shippingAddressErrors);

  if (shippingAddressErrors.length > 0) {
    errors.push(`shippingAddress invalid: ${shippingAddressErrors.join(", ")}`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      id,
      orderNumber,
      status: status as OrderStatus,
      shippingAddress: {
        recipient,
        street,
        number,
        neighborhood,
        city,
        state,
        zipCode,
        country,
      },
      ...base.data,
    },
  };
}
