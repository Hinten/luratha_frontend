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
    zoomUrl: "https://placehold.co/2000x2500/EDE4D9/3A2F2A?text=Imagem+1+Zoom",
  },
  {
    id: "img-2",
    defaultUrl: "https://placehold.co/1200x1500/D9D2C7/3A2F2A?text=Imagem+2",
    alt: "Vestido Bordado — imagem 2",
    srcSet:
      "https://placehold.co/480x600/D9D2C7/3A2F2A?text=Imagem+2+Mobile 480w, https://placehold.co/768x960/D9D2C7/3A2F2A?text=Imagem+2+Tablet 768w, https://placehold.co/1200x1500/D9D2C7/3A2F2A?text=Imagem+2 1200w",
    zoomUrl: null,
  },
  {
    id: "img-3",
    defaultUrl: "https://placehold.co/1200x1500/E8B9C9/3A2F2A?text=Imagem+3",
    alt: "Vestido Bordado — imagem 3",
    srcSet:
      "https://placehold.co/480x600/E8B9C9/3A2F2A?text=Imagem+3+Mobile 480w, https://placehold.co/768x960/E8B9C9/3A2F2A?text=Imagem+3+Tablet 768w, https://placehold.co/1200x1500/E8B9C9/3A2F2A?text=Imagem+3 1200w",
    zoomUrl: null,
  },
];

describe("ProductGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the main image with the correct src", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    const mainImg = screen.getByAltText("Vestido Bordado — imagem 1");
    expect(mainImg).toHaveAttribute("src", images[0].defaultUrl);
  });

  it("renders the main image with a descriptive alt text", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    expect(screen.getByAltText("Vestido Bordado — imagem 1")).toBeInTheDocument();
  });

  it("renders thumbnail buttons when there are multiple images", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    const thumbBtns = images.map((_, index) =>
      screen.getByRole("button", { name: `Ver imagem ${index + 1}` }),
    );
    expect(thumbBtns).toHaveLength(images.length);
  });

  it("does NOT render thumbnails when there is only one image", () => {
    render(<ProductGallery images={[images[0]]} productName="Vestido Bordado" />);
    expect(screen.queryByRole("button", { name: "Ver imagem 1" })).not.toBeInTheDocument();
  });

  it("changes the main image when a thumbnail is clicked", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver imagem 2" }));
    const mainImg = screen.getByAltText("Vestido Bordado — imagem 2");
    expect(mainImg).toHaveAttribute("src", images[1].defaultUrl);
  });

  it("the first thumbnail is marked as active (aria-pressed=true) by default", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    expect(screen.getByRole("button", { name: "Ver imagem 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Ver imagem 2" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders thumbnail list with aria-label", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    expect(screen.getByRole("list", { name: "Miniaturas do produto" })).toBeInTheDocument();
  });

  it("does not render resolution links", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    expect(screen.queryByRole("list", { name: "Links da imagem" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mobile" })).not.toBeInTheDocument();
  });

  it("opens and closes zoom overlay when zoom image exists", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    fireEvent.pointerDown(screen.getByAltText("Vestido Bordado — imagem 1"), {
      clientX: 120,
      clientY: 100,
    });
    fireEvent.pointerUp(screen.getByAltText("Vestido Bordado — imagem 1"), {
      clientX: 120,
      clientY: 100,
    });
    expect(screen.getByRole("dialog", { name: "Imagem ampliada" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Fechar zoom" }));
    expect(screen.queryByRole("dialog", { name: "Imagem ampliada" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("changes the active image on desktop hover over thumbnails", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Ver imagem 3" }));
    const mainImg = screen.getByAltText("Vestido Bordado — imagem 3");
    expect(mainImg).toHaveAttribute("src", images[2].defaultUrl);
  });

  it("changes the active image by dragging the main image", () => {
    render(<ProductGallery images={images} productName="Vestido Bordado" />);
    const mainImage = screen.getByAltText("Vestido Bordado — imagem 1");

    fireEvent.pointerDown(mainImage, { clientX: 220, clientY: 100 });
    fireEvent.pointerMove(mainImage, { clientX: 120, clientY: 102 });
    fireEvent.pointerUp(mainImage, { clientX: 120, clientY: 102 });

    expect(screen.getByAltText("Vestido Bordado — imagem 2")).toHaveAttribute(
      "src",
      images[1].defaultUrl,
    );
  });
});
