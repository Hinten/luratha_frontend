import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CartItem } from "@luratha/schemas";
import OrderSummary from "@/src/components/checkout/OrderSummary";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" {...props} />;
  },
}));

function makeItem(over: Partial<CartItem> = {}): CartItem {
  return {
    id: "item-1",
    userId: "u1",
    productId: "p1",
    variantSku: "SKU-1",
    productSlug: "vestido-linho",
    name: "Vestido Linho",
    photoId: "img-1",
    imageUrl: "https://cdn.test/p1.webp",
    variantLabel: "P",
    unitPrice: 200,
    quantity: 1,
    currency: "BRL",
    dimensions: null,
    addedAt: "2026-05-20T12:00:00.000Z",
    updatedAt: "2026-05-20T12:00:00.000Z",
    ...over,
  } as CartItem;
}

describe("OrderSummary", () => {
  it("renders subtotal, shipping and total formatted in BRL", () => {
    render(
      <OrderSummary
        items={[]}
        subtotal={200}
        shippingTotal={20}
        showItems={false}
      />,
    );
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("R$ 200,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 20,00")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("R$ 220,00")).toBeInTheDocument();
  });

  it("renders 'Grátis' when shipping is zero", () => {
    render(
      <OrderSummary
        items={[]}
        subtotal={300}
        shippingTotal={0}
        showItems={false}
      />,
    );
    expect(screen.getByText("Grátis")).toBeInTheDocument();
  });

  it("hides the discount row when discountTotal is 0", () => {
    render(
      <OrderSummary items={[]} subtotal={100} shippingTotal={10} showItems={false} />,
    );
    expect(screen.queryByText(/^Desconto/)).toBeNull();
  });

  it("shows discount with coupon code and subtracts from total", () => {
    render(
      <OrderSummary
        items={[]}
        subtotal={250}
        shippingTotal={20}
        discountTotal={25}
        appliedCoupon={{ code: "WELCOME10", discount: 25, type: "percentage" }}
        showItems={false}
      />,
    );
    expect(screen.getByText("Desconto (WELCOME10)")).toBeInTheDocument();
    expect(screen.getByText("− R$ 25,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 245,00")).toBeInTheDocument();
  });

  it("clamps the total at 0 when discount exceeds subtotal+shipping", () => {
    render(
      <OrderSummary
        items={[]}
        subtotal={50}
        shippingTotal={10}
        discountTotal={100}
        showItems={false}
      />,
    );
    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
  });

  it("renders items with name, variant and line price when showItems is true", () => {
    const items = [
      makeItem({ id: "i1", name: "Vestido Linho", variantLabel: "P", unitPrice: 200, quantity: 2 }),
      makeItem({ id: "i2", name: "Lenço de Seda", variantLabel: undefined, unitPrice: 80, quantity: 1 }),
    ];
    render(<OrderSummary items={items} subtotal={480} shippingTotal={0} />);
    expect(screen.getByText("Vestido Linho")).toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
    expect(screen.getByText("R$ 400,00")).toBeInTheDocument();
    expect(screen.getByText("Lenço de Seda")).toBeInTheDocument();
    expect(screen.getByText("R$ 80,00")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantidade 1")).toBeInTheDocument();
  });
});
