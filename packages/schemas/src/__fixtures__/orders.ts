import { validateOrder, type Order } from "@luratha/schemas/orders";

const FIXTURE_TIMESTAMP = "2026-01-01T00:00:00.000Z";

/**
 * Pedido `pending_payment`/PIX mínimo e válido, para os cloud tests que só
 * exercitam transições de `paymentStatus`/`status`/`paidAt`.
 *
 * Sobrescreva via `overrides` os campos relevantes de cada teste (`id`,
 * `userId`, `paymentMethod`, …) — eles ficam visíveis na chamada, sem as ~30
 * linhas de "carrinho de teste" no meio.
 *
 * Determinístico de propósito (sem `randomUUID`/`Date.now`): quem precisa de id
 * único por seed passa `{ id }`. O retorno já passa por `validateOrder`, então
 * qualquer override que quebre os invariantes do schema (totais, itemCount)
 * falha aqui mesmo, não lá na frente.
 */
export function buildPendingOrderFixture(overrides: Partial<Order> = {}): Order {
  const userId = overrides.userId ?? "user-fixture-0001";
  return validateOrder({
    id: "order-fixture-0001",
    userId,
    orderNumber: "ORD-FIXTURE01",
    status: "pending_payment",
    paymentMethod: "pix",
    paymentStatus: "pending",
    items: [
      {
        id: "item-1",
        productId: "prod-pay-001",
        itemSku: "SKU-PAY-AB",
        name: "Vestido Linho",
        photoId: "img-pay-001",
        quantity: 1,
        unitPrice: 200,
        lineTotal: 200,
        currency: "BRL",
      },
    ],
    itemCount: 1,
    subtotal: 200,
    discountTotal: 0,
    shippingTotal: 20,
    grandTotal: 220,
    currency: "BRL",
    shippingAddressPath: `userProfiles/${userId}/addresses/addr-fixture-001`,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  });
}
