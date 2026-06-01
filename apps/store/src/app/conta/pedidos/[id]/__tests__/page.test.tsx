import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { Order } from "@luratha/schemas";
import PedidoDetailPage from "@/src/app/conta/pedidos/[id]/page";

// next/link precisa de mock em testes Vitest (sem contexto de router).
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function baseOrder(overrides: Partial<Order> = {}): Order {
  const now = new Date().toISOString();
  return {
    id: "order-1",
    userId: "user-1",
    orderNumber: "ORD-12345678",
    status: "pending_payment",
    paymentMethod: "pix",
    paymentStatus: "pending",
    items: [
      {
        id: "item-1",
        productId: "p1",
        itemSku: "SKU-AB1234",
        name: "Vestido",
        photoId: "photo-1",
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
    // 2 segmentos só (não 4) → a página não tenta buscar o endereço.
    shippingAddressPath: "userProfiles/uid-1/addresses/addr-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Order;
}

/** Stub de fetch: order na 1ª chamada (/api/orders), endereço ausente na 2ª. */
function stubFetch(order: Order) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/orders/")) {
      return new Response(JSON.stringify(order), { status: 200 });
    }
    // Endereço — devolvemos 404 para exercitar o caminho "removido".
    return new Response("", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

// `use(params)` suspende no primeiro render; o `act` aguardado resolve a
// promise de params antes das asserções (findBy ainda aguarda o fetch async).
async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <PedidoDetailPage params={Promise.resolve({ id: "order-1" })} />
      </Suspense>,
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PedidoDetailPage — reexibição de pagamento", () => {
  it("reexibe o QR Code do PIX quando o pedido aguarda pagamento", async () => {
    stubFetch(
      baseOrder({
        paymentStatus: "pending",
        paymentPix: { qrCode: "00020126-PIX", qrCodeBase64: "BASE64DATA" },
      }),
    );
    await renderPage();
    const qr = await screen.findByRole("img", { name: "QR Code para pagamento PIX" });
    expect(qr.getAttribute("src")).toBe("data:image/png;base64,BASE64DATA");
    expect(screen.getByRole("button", { name: "Copiar código" })).toBeInTheDocument();
  });

  it("não exibe o QR quando o pagamento já foi confirmado", async () => {
    stubFetch(
      baseOrder({
        status: "paid",
        paymentStatus: "paid",
        paymentPix: { qrCode: "00020126-PIX", qrCodeBase64: "BASE64DATA" },
      }),
    );
    await renderPage();
    // Espera a página montar (heading do pedido aparece).
    await screen.findByText("Pedido #ORD-12345678");
    expect(screen.queryByRole("img", { name: "QR Code para pagamento PIX" })).toBeNull();
  });

  it("mostra mensagem de expirado quando o QR do PIX venceu", async () => {
    stubFetch(
      baseOrder({
        paymentStatus: "pending",
        paymentPix: {
          qrCode: "00020126-PIX",
          qrCodeBase64: "BASE64DATA",
          expiresAt: "2020-01-01T00:00:00.000Z",
        },
      }),
    );
    await renderPage();
    expect(await screen.findByText(/QR Code do PIX expirou/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "QR Code para pagamento PIX" })).toBeNull();
  });

  it("reexibe o botão do boleto quando o pedido aguarda pagamento", async () => {
    stubFetch(
      baseOrder({
        paymentMethod: "boleto",
        paymentStatus: "pending",
        paymentBoleto: { url: "https://mp.example.com/boleto.pdf" },
      }),
    );
    await renderPage();
    const link = await screen.findByRole("link", { name: "Abrir boleto em PDF" });
    expect(link.getAttribute("href")).toBe("https://mp.example.com/boleto.pdf");
  });
});
