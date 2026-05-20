import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AddressForm from "@/src/components/checkout/AddressForm";

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Nome do destinatário"), {
    target: { value: "Marina Souza" },
  });
  fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "01310-100" } });
  fireEvent.change(screen.getByLabelText("UF"), { target: { value: "sp" } });
  fireEvent.change(screen.getByLabelText("Logradouro"), {
    target: { value: "Av. Paulista" },
  });
  fireEvent.change(screen.getByLabelText("Número"), { target: { value: "1578" } });
  fireEvent.change(screen.getByLabelText("Bairro"), { target: { value: "Bela Vista" } });
  fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "São Paulo" } });
}

describe("AddressForm", () => {
  it("renders title and required fields", () => {
    render(<AddressForm title="Novo endereço" onSubmit={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Novo endereço" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do destinatário")).toBeInTheDocument();
    expect(screen.getByLabelText("CEP")).toBeInTheDocument();
    expect(screen.getByLabelText("UF")).toBeInTheDocument();
    expect(screen.getByLabelText("Logradouro")).toBeInTheDocument();
    expect(screen.getByLabelText("Número")).toBeInTheDocument();
    expect(screen.getByLabelText("Bairro")).toBeInTheDocument();
    expect(screen.getByLabelText("Cidade")).toBeInTheDocument();
  });

  it("prefills inputs from initialValues", () => {
    render(
      <AddressForm
        onSubmit={vi.fn()}
        initialValues={{
          label: "Casa",
          recipientName: "Marina",
          postalCode: "20040-001",
          line1: "Rua A",
          number: "10",
          neighborhood: "Centro",
          city: "Rio",
          state: "RJ",
        }}
      />,
    );
    expect(screen.getByLabelText("Apelido (ex: Casa, Trabalho)")).toHaveValue("Casa");
    expect(screen.getByLabelText("Nome do destinatário")).toHaveValue("Marina");
    expect(screen.getByLabelText("UF")).toHaveValue("RJ");
  });

  it("uppercases the state in the submitted payload and omits empty optional fields", async () => {
    const onSubmit = vi.fn();
    render(<AddressForm onSubmit={onSubmit} submitLabel="Salvar" />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toEqual({
      recipientName: "Marina Souza",
      postalCode: "01310-100",
      line1: "Av. Paulista",
      number: "1578",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      country: "BR",
      isDefault: false,
    });
    expect(payload.label).toBeUndefined();
    expect(payload.complement).toBeUndefined();
    expect(payload.reference).toBeUndefined();
  });

  it("includes label/complement/reference when filled", async () => {
    const onSubmit = vi.fn();
    render(<AddressForm onSubmit={onSubmit} />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Apelido (ex: Casa, Trabalho)"), {
      target: { value: "Casa" },
    });
    fireEvent.change(screen.getByLabelText("Complemento"), {
      target: { value: "apto 12" },
    });
    fireEvent.change(screen.getByLabelText("Ponto de referência (opcional)"), {
      target: { value: "Próximo ao metrô" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      label: "Casa",
      complement: "apto 12",
      reference: "Próximo ao metrô",
    });
  });

  it("hides the isDefault checkbox when hideIsDefault is true", () => {
    render(<AddressForm onSubmit={vi.fn()} hideIsDefault />);
    expect(
      screen.queryByLabelText("Tornar este o endereço padrão"),
    ).not.toBeInTheDocument();
  });

  it("renders cancel button only when onCancel is provided", () => {
    const { rerender } = render(<AddressForm onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();

    rerender(<AddressForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("shows error banner and disables submit when saving", () => {
    render(
      <AddressForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        error="CEP inválido."
        saving
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("CEP inválido.");
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<AddressForm onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
