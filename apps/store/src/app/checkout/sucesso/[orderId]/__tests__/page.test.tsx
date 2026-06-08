import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { Order } from "@luratha/schemas";

// Holder mutável: o mock do adminDb lê `state.order` em cada `get()`, então cada
// teste só precisa atribuir o pedido antes de renderizar.
const state = vi.hoisted(() => ({ order: null as Order | null }));

// next/link precisa de mock em testes Vitest (sem contexto de router).
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// redirect/notFound não são chamados no caminho feliz; se forem, o teste estoura.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect inesperado: ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("notFound inesperado");
  }),
}));

// `requireUser` retorna o dono do pedido (uid bate com order.userId).
vi.mock("@luratha/auth/requireUser", () => ({
  requireUser: vi.fn(async () => ({ uid: "user-1" })),
  AuthError: class AuthError extends Error {},
}));

vi.mock("@luratha/firestore/adminOrderConverter", () => ({ adminOrderConverter: {} }));

vi.mock("@luratha/firestore/firebaseAdmin", () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        withConverter: () => ({
          get: async () => ({ exists: state.order !== null, data: () => state.order }),
        }),
      }),
    }),
  },
}));

// SuccessClient usa CartContext (sem provider no teste) — só limpa o carrinho.
vi.mock("../SuccessClient", () => ({ default: () => null }));

import CheckoutSuccessPage from "@/src/app/checkout/sucesso/[orderId]/page";

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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Order;
}

// `use(params)` suspende no primeiro render; o `act` aguardado resolve a
// promise de params e o componente async antes das asserções.
async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <CheckoutSuccessPage params={Promise.resolve({ orderId: "order-1" })} />
      </Suspense>,
    );
  });
}

afterEach(() => {
  state.order = null;
  vi.clearAllMocks();
});

describe("CheckoutSuccessPage — copy por estado do pedido", () => {
  it("pedido pago → agradece e não mostra orientação de pagamento", async () => {
    state.order = baseOrder({
      status: "paid",
      paymentStatus: "paid",
      paymentMethod: "credit_card",
    });
    await renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Obrigada pela compra!" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Você pode acompanhar o status na sua conta/)).toBeInTheDocument();
    expect(screen.queryByText(/Falta pouco/)).toBeNull();
    expect(screen.queryByText(/em análise/)).toBeNull();
  });

  it("PIX pendente → aguardando pagamento com instrução do QR/copia e cola", async () => {
    state.order = baseOrder({ status: "pending_payment", paymentMethod: "pix" });
    await renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Pedido recebido!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Aguardando pagamento")).toBeInTheDocument();
    expect(screen.getByText(/QR Code ou o código copia e cola/)).toBeInTheDocument();
    expect(screen.queryByText("Obrigada pela compra!")).toBeNull();
  });

  it("boleto pendente → menciona compensação em 1–2 dias úteis", async () => {
    state.order = baseOrder({ status: "pending_payment", paymentMethod: "boleto" });
    await renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Pedido recebido!" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/compensação, em 1–2 dias úteis/)).toBeInTheDocument();
  });

  it("cartão pendente → pagamento em análise", async () => {
    state.order = baseOrder({ status: "pending_payment", paymentMethod: "credit_card" });
    await renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Pedido recebido!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pagamento em análise")).toBeInTheDocument();
    expect(screen.getByText(/Seu pagamento está em análise/)).toBeInTheDocument();
  });

  it('mantém o CTA "Acompanhar pedido" apontando para o detalhe do pedido', async () => {
    state.order = baseOrder({ status: "pending_payment", paymentMethod: "pix" });
    await renderPage();

    const cta = await screen.findByRole("link", { name: "Acompanhar pedido" });
    expect(cta.getAttribute("href")).toBe("/conta/pedidos/order-1");
  });
});
