import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductGallery from "@/src/components/produto/ProductGallery";

const images = [
  "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Imagem+1",
  "https://placehold.co/600x750/D9D2C7/3A2F2A?text=Imagem+2",
  "https://placehold.co/600x750/E8B9C9/3A2F2A?text=Imagem+3",
];

describe("ProductGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the main image with the correct src", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    const mainImg = screen.getAllByRole("img")[0];
    expect(mainImg).toHaveAttribute("src", images[0]);
  });

  it("renders the main image with a descriptive alt text", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    expect(
      screen.getByAltText("Vestido Bordado — imagem 1")
    ).toBeInTheDocument();
  });

  it("renders thumbnail buttons when there are multiple images", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    const thumbBtns = screen.getAllByRole("button");
    expect(thumbBtns).toHaveLength(images.length);
  });

  it("does NOT render thumbnails when there is only one image", () => {
    render(
      <ProductGallery
        images={[images[0]]}
        productName="Vestido Bordado"
      />
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("changes the main image when a thumbnail is clicked", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    const thumbBtns = screen.getAllByRole("button");
    fireEvent.click(thumbBtns[1]);
    const mainImg = screen.getAllByRole("img")[0];
    expect(mainImg).toHaveAttribute("src", images[1]);
  });

  it("the first thumbnail is marked as active (aria-pressed=true) by default", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    const thumbBtns = screen.getAllByRole("button");
    expect(thumbBtns[0]).toHaveAttribute("aria-pressed", "true");
    expect(thumbBtns[1]).toHaveAttribute("aria-pressed", "false");
  });

  it("renders thumbnail list with aria-label", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    expect(
      screen.getByRole("list", { name: "Miniaturas do produto" })
    ).toBeInTheDocument();
  });
});
