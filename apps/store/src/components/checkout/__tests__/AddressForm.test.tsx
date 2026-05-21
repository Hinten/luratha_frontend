import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddressForm from "@/src/components/checkout/AddressForm";

async function fillRequiredFields() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nome do destinatário"), "Marina Souza");
  await user.type(screen.getByLabelText("CEP"), "01310100");
  await user.selectOptions(screen.getByLabelText("UF"), "SP");
  await user.type(screen.getByLabelText("Logradouro"), "Av. Paulista");
  await user.type(screen.getByLabelText("Número"), "1578");
  await user.type(screen.getByLabelText("Bairro"), "Bela Vista");
  await user.type(screen.getByLabelText("Cidade"), "São Paulo");
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

  it("UF é um dropdown com 28 opções (27 UFs + EX) + 1 placeholder", () => {
    render(<AddressForm onSubmit={vi.fn()} />);
    const select = screen.getByLabelText("UF") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(select.options).toHaveLength(29); // 1 placeholder + 28 entries
    expect(select.options[0].value).toBe("");
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain("SP");
    expect(values).toContain("DF");
    expect(values).toContain("EX");
  });

  it("CEP é formatado com máscara enquanto o usuário digita", async () => {
    const user = userEvent.setup();
    render(<AddressForm onSubmit={vi.fn()} />);
    const cep = screen.getByLabelText("CEP") as HTMLInputElement;
    await user.type(cep, "12345678");
    expect(cep.value).toBe("12345-678");
  });

  it("prefills inputs from initialValues incluindo UF", () => {
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
    expect(screen.getByLabelText("CEP")).toHaveValue("20040-001");
  });

  it("envia o payload com country=BR e omite optional vazios", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddressForm onSubmit={onSubmit} submitLabel="Salvar" />);
    await fillRequiredFields();
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
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

  it("inclui label/complement/reference quando preenchidos", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddressForm onSubmit={onSubmit} />);
    await fillRequiredFields();
    await user.type(screen.getByLabelText("Apelido (ex: Casa, Trabalho)"), "Casa");
    await user.type(screen.getByLabelText("Complemento"), "apto 12");
    await user.type(
      screen.getByLabelText("Ponto de referência (opcional)"),
      "Próximo ao metrô",
    );
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      label: "Casa",
      complement: "apto 12",
      reference: "Próximo ao metrô",
    });
  });

  it("mostra erro inline e bloqueia submit quando campo obrigatório está vazio", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddressForm onSubmit={onSubmit} submitLabel="Salvar" />);
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    // O Zod deve barrar — onSubmit não foi chamado.
    expect(onSubmit).not.toHaveBeenCalled();
    // E erros inline aparecem nos campos obrigatórios.
    expect(
      await screen.findByText("Informe o nome do destinatário."),
    ).toBeInTheDocument();
    expect(screen.getByText("Selecione um estado.")).toBeInTheDocument();
  });

  it("mostra erro inline no CEP quando inválido no blur", async () => {
    const user = userEvent.setup();
    render(<AddressForm onSubmit={vi.fn()} />);
    const cep = screen.getByLabelText("CEP");
    await user.type(cep, "123");
    await user.tab();
    expect(
      await screen.findByText("CEP inválido. Use o formato 00000-000."),
    ).toBeInTheDocument();
  });

  it("renderiza o banner geral acima do botão de submit (não no topo)", () => {
    render(
      <AddressForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        error="Falha de rede ao salvar."
        saving
      />,
    );
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Falha de rede ao salvar.");
    // O banner deve aparecer DEPOIS do checkbox "isDefault" no DOM (próximo ao botão).
    const submitBtn = screen.getByRole("button", { name: "Salvando…" });
    expect(banner.compareDocumentPosition(submitBtn)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(submitBtn).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });

  it("mapeia serverIssues para erros inline por campo", async () => {
    render(
      <AddressForm
        onSubmit={vi.fn()}
        initialValues={{
          recipientName: "Marina",
          postalCode: "01310-100",
          line1: "Av. Paulista",
          number: "1578",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
        }}
        serverIssues={[
          {
            code: "custom",
            path: ["postalCode"],
            message: "Esse CEP não atende nossa região.",
          },
        ]}
      />,
    );
    expect(
      await screen.findByText("Esse CEP não atende nossa região."),
    ).toBeInTheDocument();
  });

  it("hides the isDefault checkbox when hideIsDefault is true", () => {
    render(<AddressForm onSubmit={vi.fn()} hideIsDefault />);
    expect(
      screen.queryByLabelText("Tornar este o endereço padrão"),
    ).not.toBeInTheDocument();
  });

  it("hides the Apelido field when hideLabel is true", () => {
    render(<AddressForm onSubmit={vi.fn()} hideLabel />);
    expect(
      screen.queryByLabelText("Apelido (ex: Casa, Trabalho)"),
    ).not.toBeInTheDocument();
    // demais campos continuam visíveis
    expect(screen.getByLabelText("Nome do destinatário")).toBeInTheDocument();
    expect(screen.getByLabelText("CEP")).toBeInTheDocument();
  });

  it("prefills recipient name from initialValues with hideLabel", () => {
    render(
      <AddressForm
        onSubmit={vi.fn()}
        hideLabel
        initialValues={{ recipientName: "Marina Souza" }}
      />,
    );
    expect(screen.getByLabelText("Nome do destinatário")).toHaveValue(
      "Marina Souza",
    );
  });

  it("renders cancel button only when onCancel is provided", () => {
    const { rerender } = render(<AddressForm onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();

    rerender(<AddressForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<AddressForm onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
