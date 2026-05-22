import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import InfoTooltip from "@/src/components/InfoTooltip";

describe("InfoTooltip", () => {
  it("renders the default '*' marker", () => {
    render(<InfoTooltip text="Frete grátis depende da região." />);
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveTextContent("*");
  });

  it("renders a custom marker when provided", () => {
    render(<InfoTooltip text="Detalhe" marker="?" />);
    expect(screen.getByRole("button")).toHaveTextContent("?");
  });

  it("exposes the text as the trigger's accessible name", () => {
    const text = "O frete grátis depende da região de entrega.";
    render(<InfoTooltip text={text} />);
    expect(screen.getByRole("button")).toHaveAccessibleName(text);
  });

  it("renders the visible tooltip text", () => {
    const text = "Varia conforme o CEP.";
    render(<InfoTooltip text={text} />);
    // Aparece duas vezes: aria-label do botão + span visível.
    expect(screen.getAllByText(text).length).toBeGreaterThanOrEqual(1);
  });
});
