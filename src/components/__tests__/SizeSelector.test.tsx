import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SizeSelector from "@/src/components/produto/SizeSelector";

// Mock AddToCartButton to isolate SizeSelector behaviour
vi.mock("@/src/components/produto/AddToCartButton", () => ({
  default: ({
    name,
    onBeforeAdd,
    disabled,
    className,
  }: {
    name: string;
    onBeforeAdd?: () => boolean;
    disabled?: boolean;
    className?: string;
  }) => (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-label={`Adicionar ${name} ao carrinho`}
      onClick={() => onBeforeAdd?.()}
    >
      ADICIONAR AO CARRINHO
    </button>
  ),
}));

const sizes = ["PP", "P", "M", "G", "GG"];
const cartProps = {
  productId: "prod-1",
  slug: "vestido-bordado",
  imageUrl: "/img/vestido.jpg",
  price: 389,
};

describe("SizeSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all size buttons", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" {...cartProps} />);
    sizes.forEach((size) => {
      expect(screen.getByRole("button", { name: size })).toBeInTheDocument();
    });
  });

  it("no size is selected by default (aria-pressed=false)", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" {...cartProps} />);
    sizes.forEach((size) => {
      expect(screen.getByRole("button", { name: size })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });
  });

  it("marks a size as selected when clicked", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("shows an error when AddToCartButton is clicked without a size", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" {...cartProps} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar .* ao carrinho/i })
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Selecione um tamanho")).toBeInTheDocument();
  });

  it("clears the error message when a size is selected after the error", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" {...cartProps} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar .* ao carrinho/i })
    );
    expect(screen.getByText("Selecione um tamanho")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "P" }));
    expect(screen.queryByText("Selecione um tamanho")).not.toBeInTheDocument();
  });

  it("does NOT show an error when a size is selected before adding", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: "G" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar .* ao carrinho/i })
    );
    expect(screen.queryByText("Selecione um tamanho")).not.toBeInTheDocument();
  });

  it("renders AddToCartButton when cart props are provided", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" {...cartProps} />);
    expect(
      screen.getByRole("button", { name: /Adicionar Vestido Bordado ao carrinho/i })
    ).toBeInTheDocument();
  });

  it("renders a fallback add-to-cart button when cart props are missing", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" />);
    expect(
      screen.getByRole("button", { name: /Adicionar Vestido Bordado ao carrinho/i })
    ).toBeInTheDocument();
  });

  it("renders the favorite button with correct aria-label when not favorited", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" {...cartProps} />);
    expect(
      screen.getByRole("button", { name: "Adicionar aos favoritos" })
    ).toBeInTheDocument();
  });

  it("toggles the favorite button state when clicked", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" {...cartProps} />);
    const favBtn = screen.getByRole("button", {
      name: "Adicionar aos favoritos",
    });
    fireEvent.click(favBtn);
    expect(
      screen.getByRole("button", { name: "Remover dos favoritos" })
    ).toBeInTheDocument();
  });

  it("renders size options group with aria-label", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" {...cartProps} />);
    expect(
      screen.getByRole("group", { name: "Selecione o tamanho" })
    ).toBeInTheDocument();
  });
});
