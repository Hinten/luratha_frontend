export { firestoreCollections } from "@/src/schemas/firestore/collections";
export {
  CategorySchema,
  type Category,
  type Category as FirestoreCategory,
  validateCategory,
} from "@/src/schemas/firestore/category";
export { photoSchema, type Photo } from "@/src/schemas/firestore/photos";
export {
  productVariantSchema,
  productImageAssetSchema,
  productSchema,
  buildProductSlug,
  slugifyProductPart,
  type ProductVariant,
  type ProductImageAsset,
  type Product,
  validateProduct,
} from "@/src/schemas/firestore/products";
export {
  stockSchema,
  type Stock,
  validateStock,
} from "@/src/schemas/firestore/stock";
export {
  cartItemSchema,
  cartSchema,
  type CartItem,
  type Cart,
  validateCartItem,
  validateCart,
  buildCartItemId,
} from "@/src/schemas/firestore/carts";
export {
  couponSchema,
  type Coupon,
  validateCoupon,
} from "@/src/schemas/firestore/coupons";
export {
  orderItemSchema,
  orderSchema,
  type OrderItem,
  type Order,
  validateOrder,
} from "@/src/schemas/firestore/orders";
export {
  addressSchema,
  type Address,
  validateAddress,
  buildAddressPath,
  ADDRESS_PATH_REGEX,
} from "@/src/schemas/firestore/addresses";
export { reviewSchema, type Review } from "@/src/schemas/firestore/reviews";
export {
  userProfileSchema,
  taxIdentitySchema,
  type UserProfile,
  type TaxIdentity,
  validateUserProfile,
} from "@/src/schemas/firestore/users";
export {
  pipelineSearchRequestSchema,
  vectorSearchRequestSchema,
  type PipelineSearchRequest,
  type VectorSearchRequest,
} from "@/src/schemas/firestore/search";
