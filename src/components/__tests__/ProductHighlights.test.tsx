import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductHighlights from "@/src/components/produto/ProductHighlights";

const highlights = [
  "Bordado à mão — cada peça é única",
  "Tecido linho 100% natural, leve e respirável",
  "Produzido em pequena escala, slow fashion",
];

describe("ProductHighlights", () => {
  it("renders a list with the correct aria-label", () => {
    render(<ProductHighlights highlights={highlights} />);
    expect(
      screen.getByRole("list", { name: "Destaques do produto" })
    ).toBeInTheDocument();
  });

  it("renders all highlight items", () => {
    render(<ProductHighlights highlights={highlights} />);
    highlights.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });

  it("renders the correct number of list items", () => {
    render(<ProductHighlights highlights={highlights} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(highlights.length);
  });

  it("renders nothing when highlights array is empty", () => {
    const { container } = render(<ProductHighlights highlights={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
