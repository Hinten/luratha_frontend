import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HomeCategoriesSection from "@/src/components/home/HomeCategoriesSection";
import { type Category, validateCategory } from "@luratha/schemas";

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

const mockCategories: Category[] = [
  validateCategory({ id: "vestidos", name: "Vestidos", slug: "vestidos" }),
  validateCategory({ id: "blusas", name: "Blusas", slug: "blusas" }),
  validateCategory({ id: "calcas", name: "Calças", slug: "calcas" }),
  validateCategory({ id: "saias", name: "Saias", slug: "saias" }),
  validateCategory({ id: "shorts", name: "Shorts", slug: "shorts" }),
  validateCategory({ id: "conjuntos", name: "Conjuntos", slug: "conjuntos" }),
  validateCategory({ id: "moletons", name: "Moletons", slug: "moletons" }),
  validateCategory({ id: "acessorios", name: "Acessórios", slug: "acessorios" }),
];

describe("HomeCategoriesSection", () => {
  it("renders category heading and links", () => {
    render(<HomeCategoriesSection categories={mockCategories} />);

    expect(screen.getByRole("heading", { name: "Explore por categoria" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vestidos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acessórios" })).toBeInTheDocument();
  });

  it("scrolls horizontally when arrow buttons are clicked", async () => {
    const user = userEvent.setup();
    const scrollBy = vi.fn();
    const clientWidth = 300;
    const scrollAmountPercentage = 0.8;

    Object.defineProperty(HTMLElement.prototype, "scrollBy", {
      value: scrollBy,
      configurable: true,
    });

    render(<HomeCategoriesSection categories={mockCategories} />);

    const track = screen.getByTestId("categories-track");
    Object.defineProperty(track, "clientWidth", { value: clientWidth, configurable: true });
    Object.defineProperty(track, "scrollWidth", { value: 900, configurable: true });
    Object.defineProperty(track, "scrollLeft", { value: 0, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    await user.click(screen.getByRole("button", { name: "Próximas categorias" }));
    expect(scrollBy).toHaveBeenCalledWith({
      left: clientWidth * scrollAmountPercentage,
      behavior: "smooth",
    });
  });
});
