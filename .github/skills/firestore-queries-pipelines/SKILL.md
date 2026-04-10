---
name: firestore-queries-pipelines
description: Activate this skill whenever the user asks to query Firestore, build data pipelines, fetch products, filter catalogs, paginate collections, manage cart or order data, or work with any Firestore read/write operation in the Luratha frontend. Covers Firebase SDK 12 patterns, TypeScript typing, server-side data fetching in Next.js App Router, and real-time listeners.
compatibility: Firebase SDK 12, Next.js 16 App Router (Server Components + Client Components), TypeScript strict mode, Firestore emulator (port 8080).
---

# Firestore Queries & Data Pipelines — Luratha Frontend

## Project setup

- **Firebase project**: `luratha-96386` (region: `us-east5`)
- **Firestore database**: `default`
- **Firebase SDK**: `firebase` v12 (client-side)
- **SDK initialization**: `src/lib/firebase.ts` — create if it does not exist (see below)
- **Emulator**: Firestore runs on `localhost:8080` when `NEXT_PUBLIC_USE_EMULATOR=true`

---

## 1. Firebase initialization (`src/lib/firebase.ts`)

Create this file once; import `db` from it everywhere.

```ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);

if (process.env.NEXT_PUBLIC_USE_EMULATOR === "true") {
  connectFirestoreEmulator(db, "localhost", 8080);
}
```

---

## 2. Collection structure

| Collection | Document fields (expected) |
|---|---|
| `products` | `id`, `name`, `slug`, `category`, `price`, `images[]`, `sizes[]`, `description`, `stock`, `tags[]`, `createdAt` |
| `categories` | `id`, `slug`, `name`, `imageUrl`, `order` |
| `orders` | `userId`, `items[]`, `total`, `status`, `createdAt` |
| `users/{uid}/cart` | subcollection — `productId`, `quantity`, `size` |
| `users/{uid}/favorites` | subcollection — `productId`, `addedAt` |

---

## 3. TypeScript types

Define shared types in `src/lib/types.ts`:

```ts
export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  images: string[];
  sizes: string[];
  description: string;
  stock: number;
  tags: string[];
  createdAt: Date;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  order: number;
}
```

---

## 4. Query patterns

### Fetch all products (server-side, App Router)

Use in Server Components only — no `"use client"` required.

```ts
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import type { Product } from "@/src/lib/types";

export async function getProducts(): Promise<Product[]> {
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
}
```

### Fetch products by category

```ts
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const q = query(
    collection(db, "products"),
    where("category", "==", category),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
}
```

> **Index required**: Composite index on `category ASC` + `createdAt DESC`. Add to `firestore.indexes.json`.

### Fetch single product by slug

```ts
import { collection, getDocs, query, where, limit } from "firebase/firestore";

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const q = query(collection(db, "products"), where("slug", "==", slug), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Product;
}
```

### Paginated product listing (cursor-based)

```ts
import {
  collection, getDocs, query, orderBy, startAfter, limit,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

export async function getProductsPage(
  pageSize: number,
  cursor?: QueryDocumentSnapshot,
): Promise<{ products: Product[]; lastDoc: QueryDocumentSnapshot | null }> {
  const constraints = cursor
    ? [orderBy("createdAt", "desc"), startAfter(cursor), limit(pageSize)]
    : [orderBy("createdAt", "desc"), limit(pageSize)];

  const q = query(collection(db, "products"), ...constraints);
  const snap = await getDocs(q);
  const products = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
  const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
  return { products, lastDoc };
}
```

---

## 5. Real-time listener (Client Components only)

Use `"use client"` and clean up in `useEffect`:

```ts
"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import type { Product } from "@/src/lib/types";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return unsub;
  }, []);

  return products;
}
```

---

## 6. Write operations

### Add/update a document (merge)

```ts
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

await setDoc(
  doc(db, "products", productId),
  { ...productData, updatedAt: serverTimestamp() },
  { merge: true },
);
```

### Delete a document

```ts
import { doc, deleteDoc } from "firebase/firestore";

await deleteDoc(doc(db, "products", productId));
```

---

## 7. Indexes (`firestore.indexes.json`)

Add composite indexes for every `where` + `orderBy` combination:

```json
{
  "indexes": [
    {
      "collectionGroup": "products",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy indexes with:

```bash
firebase deploy --only firestore:indexes
```

---

## 8. Emulator workflow

```bash
# start emulators (auth + firestore + storage)
firebase emulators:start

# seed test data (create src/scripts/seed.ts if needed)
NEXT_PUBLIC_USE_EMULATOR=true npx tsx src/scripts/seed.ts
```

Set `NEXT_PUBLIC_USE_EMULATOR=true` in `.env.local` for local development.

---

## 9. Security rules checklist

Before going to production, replace the expiring open rule in `firestore.rules`:

- [ ] Authenticated reads only for user-scoped collections (`users/{uid}/cart`, `users/{uid}/favorites`)
- [ ] Public reads for `products` and `categories`
- [ ] Writes restricted to admin claims or server-side SDK only
- [ ] No `allow write: if true` rules in production
