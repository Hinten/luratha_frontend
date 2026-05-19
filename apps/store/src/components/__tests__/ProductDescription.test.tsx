import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductDescription from "@/src/components/produto/ProductDescription";

const description =
  "Um vestido artesanal bordado à mão com motivos florais delicados, confeccionado em tecido linho de alta qualidade.";

describe("ProductDescription", () => {
  it("renders the section with correct aria-label", () => {
    render(<ProductDescription description={description} />);
    expect(
      screen.getByRole("region", { name: "Descrição do produto" })
    ).toBeInTheDocument();
  });

  it("renders the 'Descrição' heading", () => {
    render(<ProductDescription description={description} />);
    expect(
      screen.getByRole("heading", { name: "Descrição" })
    ).toBeInTheDocument();
  });

  it("renders the description text", () => {
    render(<ProductDescription description={description} />);
    expect(screen.getByText(description)).toBeInTheDocument();
  });
});
