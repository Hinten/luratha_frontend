import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HomeCategoriesSection from "@/src/components/home/HomeCategoriesSection";
import { mockCategories } from "@/src/lib/mockData";

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

    Object.defineProperty(HTMLElement.prototype, "scrollBy", {
      value: scrollBy,
      configurable: true,
    });

    render(<HomeCategoriesSection categories={mockCategories} />);

    const track = screen.getByTestId("categories-track");
    Object.defineProperty(track, "clientWidth", { value: 300, configurable: true });
    Object.defineProperty(track, "scrollWidth", { value: 900, configurable: true });
    Object.defineProperty(track, "scrollLeft", { value: 0, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    await user.click(screen.getByRole("button", { name: "Próximas categorias" }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: "smooth" });
  });
});
