import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProdutoPage from "@/src/app/produto/[slug]/page";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

// Mock client components to keep the test synchronous
vi.mock("@/src/components/ProductGallery", () => ({
  default: ({ productName }: { productName: string }) => (
    <div data-testid="product-gallery">{productName}</div>
  ),
}));

vi.mock("@/src/components/SizeSelector", () => ({
  default: ({ sizes }: { sizes: string[] }) => (
    <div data-testid="size-selector">{sizes.join(", ")}</div>
  ),
}));

describe("ProdutoPage", () => {
  it("renders the product heading for a known slug", async () => {
    const page = await ProdutoPage({
      params: Promise.resolve({ slug: "vestido-bordado-floral" }),
    });
    render(page as React.ReactElement);
    expect(
      screen.getByRole("heading", { level: 1, name: "Vestido Bordado Floral" })
    ).toBeInTheDocument();
  });

  it("renders the price for a known slug", async () => {
    const page = await ProdutoPage({
      params: Promise.resolve({ slug: "conjunto-saia-blusa-crochet" }),
    });
    render(page as React.ReactElement);
    expect(screen.getByText(/R\$\s*389/)).toBeInTheDocument();
  });

  it("calls notFound for an unknown slug", async () => {
    await expect(
      ProdutoPage({ params: Promise.resolve({ slug: "slug-que-nao-existe" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
