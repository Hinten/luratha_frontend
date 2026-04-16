import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/src/app/page";
import type { Category, Product } from "@/src/lib/types";

const getHomePageDataMock = vi.fn();

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

vi.mock("@/src/lib/homePageData", () => ({
  getHomePageData: () => getHomePageDataMock(),
}));

vi.mock("@/src/components/home/DevSeedButton", () => ({
  default: ({ enabled }: { enabled: boolean }) =>
    enabled ? <button type="button">Cadastrar dados mock</button> : null,
}));

// HeroBanner uses useEffect/useState — mock it to avoid timer issues in tests
vi.mock("@/src/components/home/HeroBanner", () => ({
  default: () => <section aria-label="Banner principal"><h1>Peças feitas com amor para durar</h1></section>,
}));

const mockCategories: Category[] = [
  {
    label: "Vestidos",
    href: "/categoria/vestidos",
    imageUrl: "https://placehold.co/600x700/EDE4D9/3A2F2A?text=Vestidos",
  },
  {
    label: "Blusas",
    href: "/categoria/blusas",
    imageUrl: "https://placehold.co/600x700/EDE4D9/3A2F2A?text=Blusas",
  },
  {
    label: "Calças",
    href: "/categoria/calcas",
    imageUrl: "https://placehold.co/600x700/EDE4D9/3A2F2A?text=Calças",
  },
];

const baseProduct: Product = {
  id: "prod_1",
  name: "Produto 1",
  slug: "produto-1",
  categorySlug: "vestidos",
  price: 199,
  imageUrl: "https://placehold.co/600x700/EDE4D9/3A2F2A?text=Produto+1",
};

const mockProducts: Product[] = [
  baseProduct,
  { ...baseProduct, id: "prod_2", name: "Produto 2", slug: "produto-2", price: 219 },
  { ...baseProduct, id: "prod_3", name: "Produto 3", slug: "produto-3", price: 239, originalPrice: 269 },
  { ...baseProduct, id: "prod_4", name: "Produto 4", slug: "produto-4", price: 179, originalPrice: 209 },
];

describe("Home page", () => {
  async function renderHomePage() {
    getHomePageDataMock.mockResolvedValue({
      categories: mockCategories,
      newArrivals: mockProducts,
      featured: mockProducts,
      sale: mockProducts.filter((product) => product.originalPrice !== undefined),
    });

    const page = await Home();
    render(page as React.ReactElement);
  }

  it("renders the hero banner", async () => {
    await renderHomePage();
    expect(screen.getByRole("region", { name: "Banner principal" })).toBeInTheDocument();
  });

  it("renders the category section heading", async () => {
    await renderHomePage();
    expect(screen.getByText("Explore por categoria")).toBeInTheDocument();
  });

  it("renders Lançamentos section", async () => {
    await renderHomePage();
    expect(screen.getByRole("heading", { name: "Lançamentos" })).toBeInTheDocument();
  });

  it("renders Destaques section", async () => {
    await renderHomePage();
    expect(screen.getByRole("heading", { name: "Destaques" })).toBeInTheDocument();
  });

  it("renders Sale section", async () => {
    await renderHomePage();
    expect(screen.getByRole("heading", { name: "SALE até 50% OFF" })).toBeInTheDocument();
  });

  it("renders category links for Vestidos, Blusas, Calças", async () => {
    await renderHomePage();
    expect(screen.getByRole("link", { name: "Vestidos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Blusas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Calças" })).toBeInTheDocument();
  });

  it("renders view-all link for Lançamentos", async () => {
    await renderHomePage();
    expect(screen.getByRole("link", { name: "Ver todos os lançamentos" })).toBeInTheDocument();
  });

  it("renders link to /sale", async () => {
    await renderHomePage();
    const saleLinks = screen.getAllByRole("link", { name: "Ver ofertas" });
    expect(saleLinks.length).toBeGreaterThan(0);
    expect(saleLinks[0]).toHaveAttribute("href", "/sale");
  });
});
