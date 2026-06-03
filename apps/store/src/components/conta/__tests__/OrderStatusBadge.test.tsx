import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import OrderStatusBadge from "@/src/components/conta/OrderStatusBadge";

describe("OrderStatusBadge", () => {
  it("pedido em contestação NÃO aparece como 'Pago'", () => {
    render(<OrderStatusBadge order={{ status: "paid", paymentStatus: "in_dispute" }} />);
    expect(screen.getByText("Em contestação")).toBeInTheDocument();
    expect(screen.queryByText("Pago")).toBeNull();
  });

  it("status desconhecido (fail-safe) → 'Em análise pela equipe técnica'", () => {
    render(<OrderStatusBadge order={{ status: "unknown", paymentStatus: "unknown" }} />);
    expect(screen.getByText("Em análise pela equipe técnica")).toBeInTheDocument();
  });

  it("aguardando PIX / boleto por método", () => {
    const { rerender } = render(
      <OrderStatusBadge order={{ status: "pending_payment", paymentStatus: "awaiting_pix" }} />,
    );
    expect(screen.getByText("Aguardando pagamento do PIX")).toBeInTheDocument();

    rerender(
      <OrderStatusBadge order={{ status: "pending_payment", paymentStatus: "awaiting_boleto" }} />,
    );
    expect(screen.getByText("Aguardando pagamento do boleto")).toBeInTheDocument();
  });

  it("pedido pago/entregue mostra o status de fulfillment", () => {
    render(<OrderStatusBadge order={{ status: "delivered", paymentStatus: "paid" }} />);
    expect(screen.getByText("Entregue")).toBeInTheDocument();
  });
});
