import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryBlock from "@/src/components/categoria/CategoryBlock";
import { type Category, validateCategory } from "@/src/schemas/firestore";

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

const mockCategory: Category = validateCategory({
  id: "vestidos",
  name: "Vestidos",
  slug: "vestidos",
});

describe("CategoryBlock", () => {
  it("renders the category label text", () => {
    render(<CategoryBlock category={mockCategory} />);
    expect(screen.getByText("Vestidos")).toBeInTheDocument();
  });

  it("renders a link with aria-label and correct href", () => {
    render(<CategoryBlock category={mockCategory} />);
    const link = screen.getByRole("link", { name: "Vestidos" });
    expect(link).toHaveAttribute("href", "/categoria/vestidos");
  });

  it("renders the fallback 404 image when no category image is provided", () => {
    const { container } = render(<CategoryBlock category={mockCategory} />);
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(decodeURIComponent(img!.getAttribute("src") ?? "")).toContain("/image_404.png");
  });
});
