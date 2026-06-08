import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/src/app/page";
import {
  buildProductSlug,
  type Category,
  type Product,
  validateCategory,
  validateProduct,
} from "@luratha/schemas";

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
  default: () => (
    <section aria-label="Banner principal">
      <h1>Peças feitas com amor para durar</h1>
    </section>
  ),
}));

const mockCategories: Category[] = [
  validateCategory({ id: "vestidos", name: "Vestidos", slug: "vestidos" }),
  validateCategory({ id: "blusas", name: "Blusas", slug: "blusas" }),
  validateCategory({ id: "calcas", name: "Calças", slug: "calcas" }),
];

function createProduct(
  id: string,
  title: string,
  price: number,
  salePrice: number | null = null,
): Product {
  const sku = `LURATHA_${id.replace(/[^A-Z0-9_]/g, "_").toUpperCase()}`;
  return validateProduct({
    id,
    title,
    slug: buildProductSlug(title, sku),
    description: "Descrição",
    sku,
    status: "active",
    isPurchasable: true,
    brandName: "Luratha",
    categoryId: "cat_vestidos",
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: { price, salePrice, priceMin: salePrice ?? price, priceMax: price, currency: "BRL" },
    photoAssets: [],
    lifeStylePhotos: [],
    totalStock: 10,
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  });
}

const mockProducts: Product[] = [
  createProduct("prod_1", "Produto 1", 199),
  createProduct("prod_2", "Produto 2", 219),
  createProduct("prod_3", "Produto 3", 269, 239),
  createProduct("prod_4", "Produto 4", 209, 179),
];

describe("Home page", () => {
  async function renderHomePage() {
    getHomePageDataMock.mockResolvedValue({
      categories: mockCategories,
      newArrivals: mockProducts,
      featured: mockProducts,
      sale: mockProducts.filter((product) => product.price.salePrice !== null),
      stockMap: new Map(),
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
