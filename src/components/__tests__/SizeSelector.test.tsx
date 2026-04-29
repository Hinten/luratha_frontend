import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SizeSelector from "@/src/components/produto/SizeSelector";
import { validateProduct, validateStock, type Product, type Stock } from "@/src/schemas/firestore";

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

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE_TIMESTAMP = "2026-01-01T00:00:00.000Z";
const BASE_PRICE = { price: 389, currency: "BRL" as const, salePrice: null, priceMin: null, priceMax: null, startDate: null, endDate: null };

function makeProduct(overrides: Record<string, unknown> = {}): Product {
  return validateProduct({
    id: "prod-1",
    title: "Vestido Bordado",
    sku: "VB_001_T",
    description: "Um vestido artesanal",
    categoryId: "cat-1",
    price: BASE_PRICE,
    status: "active",
    totalStock: 10,
    photoAssets: [],
    lifeStylePhotos: [],
    createdAt: BASE_TIMESTAMP,
    updatedAt: BASE_TIMESTAMP,
    ...overrides,
  });
}

function makeStock(overrides: Record<string, unknown> = {}): Stock {
  return validateStock({
    productId: "prod-1",
    sku: "VB_001_T",
    quantity: 10,
    hasVariants: false,
    variants: null,
    updatedAt: BASE_TIMESTAMP,
    ...overrides,
  });
}

const cartProps = {
  productId: "prod-1",
  slug: "vestido-bordado-vb-001-t",
  imageUrl: "/img/vestido.jpg",
  price: 389,
};

// Products reused across tests
const productWithSizes = makeProduct({ size: ["PP", "P", "M", "G", "GG"] });

const productWithColorAndSize = makeProduct({
  variants: [
    { id: "v1", sku: "VB_AP_001", color: ["Azul"], size: ["P"], photoIds: [], active: true, gtin: null, mpn: null, item_group_id: null },
    { id: "v2", sku: "VB_AM_001", color: ["Azul"], size: ["M"], photoIds: [], active: true, gtin: null, mpn: null, item_group_id: null },
    { id: "v3", sku: "VB_VP_001", color: ["Vermelho"], size: ["P"], photoIds: [], active: true, gtin: null, mpn: null, item_group_id: null },
  ],
});

// Stock: Azul+P=5, Azul+M=8, Vermelho+P=0 (esgotado)
const stockWithVariants = makeStock({
  quantity: 13,
  hasVariants: true,
  variants: { v1: 5, v2: 8, v3: 0 },
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SizeSelector — only sizes (no colors)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders all size buttons", () => {
    render(<SizeSelector product={productWithSizes} {...cartProps} />);
    ["PP", "P", "M", "G", "GG"].forEach((size) => {
      expect(screen.getByRole("button", { name: size })).toBeInTheDocument();
    });
  });

  it("no size is selected by default (aria-pressed=false)", () => {
    render(<SizeSelector product={productWithSizes} {...cartProps} />);
    ["PP", "P", "M", "G", "GG"].forEach((size) => {
      expect(screen.getByRole("button", { name: size })).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("marks a size as selected when clicked", () => {
    render(<SizeSelector product={productWithSizes} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows an error when AddToCartButton is clicked without a size", () => {
    render(<SizeSelector product={productWithSizes} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Selecione um tamanho")).toBeInTheDocument();
  });

  it("clears the error message when a size is selected after the error", () => {
    render(<SizeSelector product={productWithSizes} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(screen.getByText("Selecione um tamanho")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "P" }));
    expect(screen.queryByText("Selecione um tamanho")).not.toBeInTheDocument();
  });

  it("does NOT show an error when a size is selected before adding", () => {
    render(<SizeSelector product={productWithSizes} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: "G" }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(screen.queryByText("Selecione um tamanho")).not.toBeInTheDocument();
  });

  it("renders AddToCartButton when cart props are provided", () => {
    render(<SizeSelector product={productWithSizes} {...cartProps} />);
    expect(
      screen.getByRole("button", { name: /Adicionar Vestido Bordado ao carrinho/i })
    ).toBeInTheDocument();
  });

  it("renders a fallback add-to-cart button when cart props are missing", () => {
    render(<SizeSelector product={productWithSizes} />);
    expect(
      screen.getByRole("button", { name: /Adicionar Vestido Bordado ao carrinho/i })
    ).toBeInTheDocument();
  });

  it("renders the size options group with aria-label", () => {
    render(<SizeSelector product={productWithSizes} {...cartProps} />);
    expect(screen.getByRole("group", { name: "Selecione o tamanho" })).toBeInTheDocument();
  });
});

describe("SizeSelector — favorite button", () => {
  it("renders the favorite button with correct aria-label when not favorited", () => {
    render(<SizeSelector product={productWithSizes} {...cartProps} />);
    expect(screen.getByRole("button", { name: "Adicionar aos favoritos" })).toBeInTheDocument();
  });

  it("toggles the favorite button state when clicked", () => {
    render(<SizeSelector product={productWithSizes} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar aos favoritos" }));
    expect(screen.getByRole("button", { name: "Remover dos favoritos" })).toBeInTheDocument();
  });
});

describe("SizeSelector — simple product (no variants)", () => {
  it("allows adding to cart without any selection required", () => {
    const product = makeProduct({ totalStock: 5 });
    render(<SizeSelector product={product} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar Vestido Bordado ao carrinho/i }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows 'PRODUTO ESGOTADO' button when simple product has 0 stock", () => {
    const product = makeProduct({ totalStock: 0 });
    const stock = makeStock({ quantity: 0 });
    render(<SizeSelector product={product} stock={stock} {...cartProps} />);
    const btn = screen.getByRole("button", { name: /PRODUTO ESGOTADO/i });
    expect(btn).toBeDisabled();
  });

  it("shows 'PRODUTO ESGOTADO' from product.totalStock when no stock doc", () => {
    const product = makeProduct({ totalStock: 0 });
    render(<SizeSelector product={product} {...cartProps} />);
    expect(screen.getByRole("button", { name: /PRODUTO ESGOTADO/i })).toBeDisabled();
  });

  it("shows 'Em estoque' when quantity > 5", () => {
    const product = makeProduct({ totalStock: 8 });
    const stock = makeStock({ quantity: 8 });
    render(<SizeSelector product={product} stock={stock} />);
    expect(screen.getByText("Em estoque")).toBeInTheDocument();
  });

  it("shows urgency message 'Últimas 2 peças!' when qty is 2", () => {
    const product = makeProduct({ totalStock: 2 });
    const stock = makeStock({ quantity: 2 });
    render(<SizeSelector product={product} stock={stock} />);
    expect(screen.getByText("Últimas 2 peças!")).toBeInTheDocument();
  });

  it("shows urgency message 'Última peça!' when qty is 1", () => {
    const product = makeProduct({ totalStock: 1 });
    const stock = makeStock({ quantity: 1 });
    render(<SizeSelector product={product} stock={stock} />);
    expect(screen.getByText("Última peça!")).toBeInTheDocument();
  });

  it("falls back to product.totalStock for stock message when stock prop is absent", () => {
    const product = makeProduct({ totalStock: 3 });
    render(<SizeSelector product={product} />);
    expect(screen.getByText("Últimas 3 peças!")).toBeInTheDocument();
  });
});

describe("SizeSelector — color + size with stock-aware variants", () => {
  it("renders color selector group", () => {
    render(<SizeSelector product={productWithColorAndSize} stock={stockWithVariants} {...cartProps} />);
    expect(screen.getByRole("group", { name: "Selecione a cor" })).toBeInTheDocument();
  });

  it("renders color buttons for each unique color", () => {
    render(<SizeSelector product={productWithColorAndSize} stock={stockWithVariants} {...cartProps} />);
    expect(screen.getByRole("button", { name: "Azul" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vermelho" })).toBeInTheDocument();
  });

  it("marks color as selected when clicked", () => {
    render(<SizeSelector product={productWithColorAndSize} stock={stockWithVariants} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Azul" }));
    expect(screen.getByRole("button", { name: "Azul" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Vermelho" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows error when trying to add without selecting a color", () => {
    render(<SizeSelector product={productWithColorAndSize} stock={stockWithVariants} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(screen.getByText("Selecione uma cor")).toBeInTheDocument();
  });

  it("shows 'PRODUTO ESGOTADO' when selecting a fully out-of-stock color+size combo", () => {
    render(<SizeSelector product={productWithColorAndSize} stock={stockWithVariants} {...cartProps} />);
    // Vermelho+P has qty=0
    fireEvent.click(screen.getByRole("button", { name: "Vermelho" }));
    fireEvent.click(screen.getByRole("button", { name: "P" }));
    expect(screen.getByRole("button", { name: /PRODUTO ESGOTADO/i })).toBeDisabled();
  });

  it("resets selected size when color changes", () => {
    render(<SizeSelector product={productWithColorAndSize} stock={stockWithVariants} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Azul" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute("aria-pressed", "true");
    // Change color — size should reset
    fireEvent.click(screen.getByRole("button", { name: "Vermelho" }));
    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows stock urgency for a valid combo (Azul+P has qty=5)", () => {
    render(<SizeSelector product={productWithColorAndSize} stock={stockWithVariants} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Azul" }));
    fireEvent.click(screen.getByRole("button", { name: "P" }));
    expect(screen.getByText("Últimas 5 peças!")).toBeInTheDocument();
  });

  it("shows 'Em estoque' for a combo with qty > 5 (Azul+M has qty=8)", () => {
    render(<SizeSelector product={productWithColorAndSize} stock={stockWithVariants} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Azul" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    expect(screen.getByText("Em estoque")).toBeInTheDocument();
  });

  it("does not show normal add-to-cart when combo is out of stock", () => {
    render(<SizeSelector product={productWithColorAndSize} stock={stockWithVariants} {...cartProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Vermelho" }));
    fireEvent.click(screen.getByRole("button", { name: "P" }));
    expect(screen.queryByRole("button", { name: /Adicionar .* ao carrinho/i })).not.toBeInTheDocument();
  });
});

// ─── Color swatch (image variant) and selection callbacks ──────────────────

describe("SizeSelector — color swatch image fallback", () => {
  it("renders text pill when variants have no photoIds (no swatch available)", () => {
    render(<SizeSelector product={productWithColorAndSize} stock={stockWithVariants} {...cartProps} />);
    const azulButton = screen.getByRole("button", { name: "Azul" });
    expect(azulButton.tagName).toBe("BUTTON");
    expect(azulButton.querySelector("img")).toBeNull();
  });
});

describe("SizeSelector — color swatch image when variant has photo", () => {
  const productWithSwatchPhotos = makeProduct({
    photoAssets: [
      {
        id: "photo_azul",
        alt: "Azul",
        resolutions: {
          card: {
            width: 400,
            height: 533,
            storagePath: "products/p/azul/card.webp",
            downloadUrl: "https://example.com/azul-card.webp",
            temporaryUrl: null,
            format: "webp",
          },
          mobile: {
            width: 480,
            height: 640,
            storagePath: "products/p/azul/mobile.webp",
            downloadUrl: "https://example.com/azul-mobile.webp",
            temporaryUrl: null,
            format: "webp",
          },
          tablet: {
            width: 768,
            height: 1024,
            storagePath: "products/p/azul/tablet.webp",
            downloadUrl: "https://example.com/azul-tablet.webp",
            temporaryUrl: null,
            format: "webp",
          },
          desktop: {
            width: 1200,
            height: 1600,
            storagePath: "products/p/azul/desktop.webp",
            downloadUrl: "https://example.com/azul-desktop.webp",
            temporaryUrl: null,
            format: "webp",
          },
        },
        createdAt: BASE_TIMESTAMP,
        updatedAt: BASE_TIMESTAMP,
      },
    ],
    variants: [
      { id: "v1", sku: "SK_AZ_P", color: ["Azul"], size: ["P"], photoIds: ["photo_azul"], active: true, gtin: null, mpn: null, item_group_id: null },
      { id: "v2", sku: "SK_VM_P", color: ["Vermelho"], size: ["P"], photoIds: [], active: true, gtin: null, mpn: null, item_group_id: null },
    ],
  });

  it("renders an image swatch for a color whose variant has a photoId", () => {
    render(<SizeSelector product={productWithSwatchPhotos} {...cartProps} />);
    const azulButton = screen.getByRole("button", { name: "Azul" });
    const img = azulButton.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("https://example.com/azul-card.webp");
  });

  it("falls back to text pill for a color whose variant has no photoId", () => {
    render(<SizeSelector product={productWithSwatchPhotos} {...cartProps} />);
    const vermelhoButton = screen.getByRole("button", { name: "Vermelho" });
    expect(vermelhoButton.querySelector("img")).toBeNull();
  });
});

describe("SizeSelector — onColorChange / onSizeChange callbacks", () => {
  it("calls onColorChange with the clicked color", () => {
    const onColorChange = vi.fn();
    render(
      <SizeSelector
        product={productWithColorAndSize}
        stock={stockWithVariants}
        onColorChange={onColorChange}
        {...cartProps}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Azul" }));
    expect(onColorChange).toHaveBeenCalledWith("Azul");
  });

  it("calls onSizeChange with the clicked size", () => {
    const onSizeChange = vi.fn();
    render(
      <SizeSelector
        product={productWithColorAndSize}
        stock={stockWithVariants}
        onSizeChange={onSizeChange}
        {...cartProps}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Azul" }));
    fireEvent.click(screen.getByRole("button", { name: "P" }));
    expect(onSizeChange).toHaveBeenCalledWith("P");
  });

  it("resets size via onSizeChange(null) when color is changed", () => {
    const onSizeChange = vi.fn();
    render(
      <SizeSelector
        product={productWithColorAndSize}
        stock={stockWithVariants}
        onSizeChange={onSizeChange}
        {...cartProps}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Azul" }));
    fireEvent.click(screen.getByRole("button", { name: "P" }));
    onSizeChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Vermelho" }));
    expect(onSizeChange).toHaveBeenCalledWith(null);
  });
});
