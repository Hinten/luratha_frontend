export const firestoreCollections = {
  categories: "categories",
  photos: "photos",
  products: "products",
  stock: "stock",
  carts: "carts",
  cartItems: "items",
  orders: "orders",
  coupons: "coupons",
  userProfiles: "userProfiles",
  /** Subcoleção sob `userProfiles/{uid}/addresses/{addressId}`. */
  addresses: "addresses",
  reviews: "reviews",
  /** Documento único `settings/global` com configuração operacional do e-commerce. */
  settings: "settings",
} as const;

/** ID do documento de configuração global dentro da coleção `settings`. */
export const SITE_SETTINGS_DOC_ID = "global";
