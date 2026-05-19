import { describe, it, expect } from "vitest";
import { Timestamp as ClientTimestamp } from "firebase/firestore";
import { Timestamp as AdminTimestamp } from "firebase-admin/firestore";

import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { clientOrderConverter } from "@luratha/firestore/clientOrderConverter";
import { adminUserProfileConverter } from "@luratha/firestore/adminUserProfileConverter";
import { clientUserProfileConverter } from "@luratha/firestore/clientUserProfileConverter";
import { adminCouponConverter } from "@luratha/firestore/adminCouponConverter";
import { clientCouponConverter } from "@luratha/firestore/clientCouponConverter";

import {
  validateOrder,
  validateUserProfile,
  validateCoupon,
  type Order,
  type UserProfile,
  type Coupon,
} from "@luratha/schemas";

const ISO_NOW = "2024-06-01T12:00:00.000Z";
const ISO_LATER = "2024-12-31T23:59:59.000Z";

function buildOrder(): Order {
  return validateOrder({
    id: "order-001",
    userId: "user-abc-123456",
    orderNumber: "ORD-12345678",
    status: "paid",
    paymentMethod: "pix",
    paymentStatus: "paid",
    items: [
      {
        id: "item-1",
        productId: "prod-001",
        variantId: "var-001-p",
        itemSku: "SKU-001-AB",
        name: "Vestido Linho",
        photoId: "img-001",
        quantity: 2,
        unitPrice: 100,
        lineTotal: 200,
        currency: "BRL",
      },
    ],
    itemCount: 2,
    subtotal: 200,
    discountTotal: 0,
    shippingTotal: 20,
    grandTotal: 220,
    currency: "BRL",
    shippingAddressPath: "userProfiles/user-abc-123456/addresses/addr-001",
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  });
}

function buildUser(): UserProfile {
  return validateUserProfile({
    id: "user-abc-123456",
    email: "joao@example.com",
    firstName: "João",
    lastName: "Silva",
    role: "customer",
    taxIdentity: {
      type: "PF",
      cpf: "123.456.789-09",
    },
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
  });
}

function buildCoupon(): Coupon {
  return validateCoupon({
    id: "coupon-summer",
    code: "SUMMER10",
    type: "percentage",
    amount: 10,
    startsAt: ISO_NOW,
    expiresAt: ISO_LATER,
    active: true,
  });
}

describe("clientOrderConverter", () => {
  it("toFirestore wraps ISO timestamps into Firestore Timestamps", () => {
    const order = buildOrder();
    const written = clientOrderConverter.toFirestore(order) as Record<string, unknown>;

    expect(written.createdAt).toBeInstanceOf(ClientTimestamp);
    expect(written.updatedAt).toBeInstanceOf(ClientTimestamp);
    expect((written.createdAt as ClientTimestamp).toDate().toISOString()).toBe(ISO_NOW);
  });

  it("round-trips a valid order through toFirestore + fromFirestore", () => {
    const order = buildOrder();
    const written = clientOrderConverter.toFirestore(order) as Record<string, unknown>;

    const fakeSnapshot = {
      data: () => written,
    } as Parameters<typeof clientOrderConverter.fromFirestore>[0];

    const read = clientOrderConverter.fromFirestore(fakeSnapshot);
    expect(read).toEqual(order);
  });
});

describe("adminOrderConverter", () => {
  it("toFirestore wraps ISO timestamps into admin Timestamps", () => {
    const order = buildOrder();
    const written = adminOrderConverter.toFirestore(order) as Record<string, unknown>;

    expect(written.createdAt).toBeInstanceOf(AdminTimestamp);
    expect((written.createdAt as AdminTimestamp).toDate().toISOString()).toBe(ISO_NOW);
  });

  it("round-trips a valid order", () => {
    const order = buildOrder();
    const written = adminOrderConverter.toFirestore(order);
    const fakeSnapshot = { data: () => written } as Parameters<
      typeof adminOrderConverter.fromFirestore
    >[0];
    const read = adminOrderConverter.fromFirestore(fakeSnapshot);
    expect(read).toEqual(order);
  });
});

describe("clientUserProfileConverter", () => {
  it("round-trips a valid profile", () => {
    const profile = buildUser();
    const written = clientUserProfileConverter.toFirestore(profile) as Record<string, unknown>;
    expect(written.createdAt).toBeInstanceOf(ClientTimestamp);

    const fakeSnapshot = { data: () => written } as Parameters<
      typeof clientUserProfileConverter.fromFirestore
    >[0];
    const read = clientUserProfileConverter.fromFirestore(fakeSnapshot);
    expect(read).toEqual(profile);
  });
});

describe("adminUserProfileConverter", () => {
  it("round-trips a valid profile", () => {
    const profile = buildUser();
    const written = adminUserProfileConverter.toFirestore(profile);
    expect((written as Record<string, unknown>).updatedAt).toBeInstanceOf(AdminTimestamp);

    const fakeSnapshot = { data: () => written } as Parameters<
      typeof adminUserProfileConverter.fromFirestore
    >[0];
    const read = adminUserProfileConverter.fromFirestore(fakeSnapshot);
    expect(read).toEqual(profile);
  });
});

describe("clientCouponConverter", () => {
  it("converts startsAt and expiresAt and round-trips", () => {
    const coupon = buildCoupon();
    const written = clientCouponConverter.toFirestore(coupon) as Record<string, unknown>;

    expect(written.startsAt).toBeInstanceOf(ClientTimestamp);
    expect(written.expiresAt).toBeInstanceOf(ClientTimestamp);

    const fakeSnapshot = { data: () => written } as Parameters<
      typeof clientCouponConverter.fromFirestore
    >[0];
    const read = clientCouponConverter.fromFirestore(fakeSnapshot);
    expect(read).toEqual(coupon);
  });
});

describe("adminCouponConverter", () => {
  it("round-trips a valid coupon", () => {
    const coupon = buildCoupon();
    const written = adminCouponConverter.toFirestore(coupon);
    const fakeSnapshot = { data: () => written } as Parameters<
      typeof adminCouponConverter.fromFirestore
    >[0];
    const read = adminCouponConverter.fromFirestore(fakeSnapshot);
    expect(read).toEqual(coupon);
  });
});
