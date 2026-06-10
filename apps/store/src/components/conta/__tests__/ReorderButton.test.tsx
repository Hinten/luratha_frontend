import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReorderButton from "@/src/components/conta/ReorderButton";
import type { CartItemInput } from "@/src/contexts/CartContext";

const pushMock = vi.fn();

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

let fetchMock: ReturnType<typeof vi.fn>;

/**
 * Mock de fetch que roteia por URL: devolve o corpo do reorder no endpoint
 * `/reorder` e simula `/api/cart/items` com o status configurado (200 default).
 */
function stubFlow(
  body: { items: CartItemInput[]; unavailable: { name: string; reason: string }[] },
  cartItemsStatus = 200,
) {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/reorder")) {
      return new Response(JSON.stringify(body), { status: 200 });
    }
    // /api/cart/items
    return new Response("{}", { status: cartItemsStatus });
  });
  vi.stubGlobal("fetch", fetchMock);
}

function cartItemPostCount(): number {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes("/api/cart/items")).length;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ReorderButton", () => {
  it("re-adiciona todos os itens e navega para /checkout quando todos estão disponíveis", async () => {
    const user = userEvent.setup();
    stubFlow({ items: [item("a"), item("b")], unavailable: [] });

    render(<ReorderButton orderId="order-1" />);
    await user.click(screen.getByRole("button", { name: "Pedir novamente" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/checkout"));
    expect(cartItemPostCount()).toBe(2);
  });

  it("avisa sobre itens pulados e só navega após o cliente confirmar", async () => {
    const user = userEvent.setup();
    stubFlow({
      items: [item("a")],
      unavailable: [{ name: "Vestido Esgotado", reason: "sem estoque" }],
    });

    render(<ReorderButton orderId="order-1" />);
    await user.click(screen.getByRole("button", { name: "Pedir novamente" }));

    expect(await screen.findByText(/não estão mais disponíveis/i)).toBeInTheDocument();
    expect(screen.getByText(/Vestido Esgotado/)).toBeInTheDocument();
    expect(cartItemPostCount()).toBe(1);
    expect(pushMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Ir para o checkout" }));
    expect(pushMock).toHaveBeenCalledWith("/checkout");
  });

  it("mostra mensagem e não navega quando nenhum item está disponível", async () => {
    const user = userEvent.setup();
    stubFlow({
      items: [],
      unavailable: [{ name: "Produto X", reason: "removido" }],
    });

    render(<ReorderButton orderId="order-1" />);
    await user.click(screen.getByRole("button", { name: "Pedir novamente" }));

    expect(
      await screen.findByText(/Nenhum item deste pedido está disponível/i),
    ).toBeInTheDocument();
    expect(cartItemPostCount()).toBe(0);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("mostra o motivo do servidor quando a API de reorder falha", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "boom" }), { status: 500 })),
    );

    render(<ReorderButton orderId="order-1" />);
    await user.click(screen.getByRole("button", { name: "Pedir novamente" }));

    // O alerta surface a mensagem real do servidor, não um texto fixo.
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("mostra o motivo e não navega quando uma adição ao carrinho falha", async () => {
    const user = userEvent.setup();
    // reorder devolve itens disponíveis, mas o POST /api/cart/items falha (409)
    // com corpo vazio — cai no fallback do throwIfNotOk de adicionar item.
    stubFlow({ items: [item("a")], unavailable: [] }, 409);

    render(<ReorderButton orderId="order-1" />);
    await user.click(screen.getByRole("button", { name: "Pedir novamente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível adicionar um item ao carrinho/i,
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
