import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReorderButton from "@/src/components/conta/ReorderButton";
import type { CartItemInput } from "@/src/contexts/CartContext";

const addItemMock = vi.fn<(input: CartItemInput) => Promise<void>>();
const pushMock = vi.fn();

vi.mock("@/src/contexts/CartContext", () => ({
  useCart: () => ({
    addItem: addItemMock,
    isSyncing: false,
    items: [],
    cart: {},
    totalItems: 0,
    totalPrice: 0,
    isReady: true,
    error: null,
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function item(id: string): CartItemInput {
  return {
    productId: id,
    variantSku: `SKU-${id}`,
    productSlug: `slug-${id}`,
    name: `Produto ${id}`,
    photoId: `photo-${id}`,
    imageUrl: `https://example.com/${id}.webp`,
    unitPrice: 100,
    currency: "BRL",
    quantity: 1,
  };
}

function stubReorder(body: {
  items: CartItemInput[];
  unavailable: { name: string; reason: string }[];
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ReorderButton", () => {
  it("re-adiciona todos os itens e navega para /checkout quando todos estão disponíveis", async () => {
    const user = userEvent.setup();
    addItemMock.mockResolvedValue();
    stubReorder({ items: [item("a"), item("b")], unavailable: [] });

    render(<ReorderButton orderId="order-1" />);
    await user.click(screen.getByRole("button", { name: "Pedir novamente" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/checkout"));
    expect(addItemMock).toHaveBeenCalledTimes(2);
    expect(addItemMock).toHaveBeenNthCalledWith(1, item("a"));
    expect(addItemMock).toHaveBeenNthCalledWith(2, item("b"));
  });

  it("avisa sobre itens pulados e só navega após o cliente confirmar", async () => {
    const user = userEvent.setup();
    addItemMock.mockResolvedValue();
    stubReorder({
      items: [item("a")],
      unavailable: [{ name: "Vestido Esgotado", reason: "sem estoque" }],
    });

    render(<ReorderButton orderId="order-1" />);
    await user.click(screen.getByRole("button", { name: "Pedir novamente" }));

    expect(await screen.findByText(/não estão mais disponíveis/i)).toBeInTheDocument();
    expect(screen.getByText(/Vestido Esgotado/)).toBeInTheDocument();
    expect(addItemMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Ir para o checkout" }));
    expect(pushMock).toHaveBeenCalledWith("/checkout");
  });

  it("mostra mensagem e não navega quando nenhum item está disponível", async () => {
    const user = userEvent.setup();
    stubReorder({
      items: [],
      unavailable: [{ name: "Produto X", reason: "removido" }],
    });

    render(<ReorderButton orderId="order-1" />);
    await user.click(screen.getByRole("button", { name: "Pedir novamente" }));

    expect(
      await screen.findByText(/Nenhum item deste pedido está disponível/i),
    ).toBeInTheDocument();
    expect(addItemMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("mostra erro recuperável quando a API falha", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "boom" }), { status: 500 })),
    );

    render(<ReorderButton orderId="order-1" />);
    await user.click(screen.getByRole("button", { name: "Pedir novamente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível refazer/i);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
