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
} as const;
