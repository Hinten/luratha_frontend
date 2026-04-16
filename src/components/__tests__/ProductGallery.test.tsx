import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductGallery from "@/src/components/produto/ProductGallery";

const images = [
  {
    id: "img-1",
    defaultUrl: "https://placehold.co/1200x1500/EDE4D9/3A2F2A?text=Imagem+1",
    alt: "Vestido Bordado — imagem 1",
    srcSet:
      "https://placehold.co/480x600/EDE4D9/3A2F2A?text=Imagem+1+Mobile 480w, https://placehold.co/768x960/EDE4D9/3A2F2A?text=Imagem+1+Tablet 768w, https://placehold.co/1200x1500/EDE4D9/3A2F2A?text=Imagem+1 1200w",
    links: [
      { label: "Mobile", url: "https://placehold.co/480x600/EDE4D9/3A2F2A?text=Imagem+1+Mobile" },
      { label: "Tablet", url: "https://placehold.co/768x960/EDE4D9/3A2F2A?text=Imagem+1+Tablet" },
      { label: "Desktop", url: "https://placehold.co/1200x1500/EDE4D9/3A2F2A?text=Imagem+1" },
    ],
  },
  {
    id: "img-2",
    defaultUrl: "https://placehold.co/1200x1500/D9D2C7/3A2F2A?text=Imagem+2",
    alt: "Vestido Bordado — imagem 2",
    srcSet:
      "https://placehold.co/480x600/D9D2C7/3A2F2A?text=Imagem+2+Mobile 480w, https://placehold.co/768x960/D9D2C7/3A2F2A?text=Imagem+2+Tablet 768w, https://placehold.co/1200x1500/D9D2C7/3A2F2A?text=Imagem+2 1200w",
    links: [
      { label: "Mobile", url: "https://placehold.co/480x600/D9D2C7/3A2F2A?text=Imagem+2+Mobile" },
      { label: "Tablet", url: "https://placehold.co/768x960/D9D2C7/3A2F2A?text=Imagem+2+Tablet" },
      { label: "Desktop", url: "https://placehold.co/1200x1500/D9D2C7/3A2F2A?text=Imagem+2" },
    ],
  },
  {
    id: "img-3",
    defaultUrl: "https://placehold.co/1200x1500/E8B9C9/3A2F2A?text=Imagem+3",
    alt: "Vestido Bordado — imagem 3",
    srcSet:
      "https://placehold.co/480x600/E8B9C9/3A2F2A?text=Imagem+3+Mobile 480w, https://placehold.co/768x960/E8B9C9/3A2F2A?text=Imagem+3+Tablet 768w, https://placehold.co/1200x1500/E8B9C9/3A2F2A?text=Imagem+3 1200w",
    links: [
      { label: "Mobile", url: "https://placehold.co/480x600/E8B9C9/3A2F2A?text=Imagem+3+Mobile" },
      { label: "Tablet", url: "https://placehold.co/768x960/E8B9C9/3A2F2A?text=Imagem+3+Tablet" },
      { label: "Desktop", url: "https://placehold.co/1200x1500/E8B9C9/3A2F2A?text=Imagem+3" },
    ],
  },
];

describe("ProductGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the main image with the correct src", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    const mainImg = screen.getAllByRole("img")[0];
    expect(mainImg).toHaveAttribute("src", images[0].defaultUrl);
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
    expect(mainImg).toHaveAttribute("src", images[1].defaultUrl);
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

  it("renders the links for active image resolutions", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    expect(screen.getByRole("list", { name: "Links da imagem" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mobile" })).toHaveAttribute("href", images[0].links[0].url);
  });
});
