import { describe, it, expect } from "vitest";
import { Timestamp as ClientTimestamp } from "firebase/firestore";
import { Timestamp as AdminTimestamp } from "firebase-admin/firestore";

import { adminStockConverter } from "@luratha/firestore/adminStockConverter";
import { clientStockConverter } from "@luratha/firestore/clientStockConverter";
import { clientCategoryConverter } from "@luratha/firestore/clientCategoryConverter";
import { adminReviewConverter } from "@luratha/firestore/adminReviewConverter";

import {
  validateStock,
  validateCategory,
  validateReview,
  type Stock,
  type Category,
  type Review,
} from "@luratha/schemas";

const ISO_NOW = "2024-06-01T12:00:00.000Z";

function buildStock(): Stock {
  return validateStock({
    productId: "prod-stock-1",
    sku: "SKU-ABC123",
    quantity: 8,
    hasVariants: false,
    variants: null,
    updatedAt: ISO_NOW,
  });
}

function buildCategory(): Category {
  return validateCategory({ id: "cat-1", name: "Vestidos", slug: "vestidos" });
}

function buildReview(): Review {
  return validateReview({
    id: "rev-1",
    productId: "prod-1",
    orderId: "order-1",
    userId: "user-abc-123456",
    rating: 5,
    title: "Ótimo",
    comment: "Produto excelente e muito bem feito.",
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  });
}

describe("clientStockConverter", () => {
  it("toFirestore wraps updatedAt into a Firestore Timestamp", () => {
    const written = clientStockConverter.toFirestore(buildStock()) as Record<string, unknown>;
    expect(written.updatedAt).toBeInstanceOf(ClientTimestamp);
    expect((written.updatedAt as ClientTimestamp).toDate().toISOString()).toBe(ISO_NOW);
  });

  it("round-trips a valid stock through toFirestore + fromFirestore", () => {
    const stock = buildStock();
    const written = clientStockConverter.toFirestore(stock) as Record<string, unknown>;
    const fakeSnapshot = { data: () => written } as Parameters<
      typeof clientStockConverter.fromFirestore
    >[0];
    expect(clientStockConverter.fromFirestore(fakeSnapshot)).toEqual(stock);
  });

  it("rejects an unknown top-level field on write", () => {
    const bogus = { ...buildStock(), notARealField: true } as Stock;
    expect(() => clientStockConverter.toFirestore(bogus)).toThrow();
  });

  it("reads a legacy string updatedAt leniently", () => {
    const legacy: Record<string, unknown> = { ...buildStock(), updatedAt: ISO_NOW };
    const fakeSnapshot = { data: () => legacy } as Parameters<
      typeof clientStockConverter.fromFirestore
    >[0];
    expect(clientStockConverter.fromFirestore(fakeSnapshot).updatedAt).toBe(ISO_NOW);
  });
});

describe("adminStockConverter", () => {
  it("toFirestore wraps updatedAt into a Firestore Timestamp", () => {
    const written = adminStockConverter.toFirestore(buildStock()) as Record<string, unknown>;
    expect(written.updatedAt).toBeInstanceOf(AdminTimestamp);
  });

  it("rejects an unknown top-level field on write", () => {
    const bogus = { ...buildStock(), notARealField: true } as Stock;
    expect(() => adminStockConverter.toFirestore(bogus)).toThrow();
  });
});

describe("clientCategoryConverter", () => {
  it("round-trips a valid category", () => {
    const category = buildCategory();
    const written = clientCategoryConverter.toFirestore(category) as Record<string, unknown>;
    const fakeSnapshot = { data: () => written } as Parameters<
      typeof clientCategoryConverter.fromFirestore
    >[0];
    expect(clientCategoryConverter.fromFirestore(fakeSnapshot)).toEqual(category);
  });

  it("rejects an unknown top-level field on write", () => {
    const bogus = { ...buildCategory(), notARealField: true } as Category;
    expect(() => clientCategoryConverter.toFirestore(bogus)).toThrow();
  });
});

describe("adminReviewConverter", () => {
  it("toFirestore wraps createdAt/updatedAt into Firestore Timestamps", () => {
    const written = adminReviewConverter.toFirestore(buildReview()) as Record<string, unknown>;
    expect(written.createdAt).toBeInstanceOf(AdminTimestamp);
    expect(written.updatedAt).toBeInstanceOf(AdminTimestamp);
  });

  it("round-trips a valid review through toFirestore + fromFirestore", () => {
    const review = buildReview();
    const written = adminReviewConverter.toFirestore(review) as Record<string, unknown>;
    const fakeSnapshot = { data: () => written } as Parameters<
      typeof adminReviewConverter.fromFirestore
    >[0];
    expect(adminReviewConverter.fromFirestore(fakeSnapshot)).toEqual(review);
  });

  it("rejects an unknown top-level field on write", () => {
    const bogus = { ...buildReview(), notARealField: true } as Review;
    expect(() => adminReviewConverter.toFirestore(bogus)).toThrow();
  });
});
