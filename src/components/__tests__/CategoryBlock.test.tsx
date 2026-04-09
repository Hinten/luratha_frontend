import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryBlock from "@/src/components/CategoryBlock";
import type { Category } from "@/src/lib/types";

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

const mockCategory: Category = {
  label: "Vestidos",
  href: "/categoria/vestidos",
  imageUrl: "https://placehold.co/600x700/EDE4D9/3A2F2A?text=Vestidos",
};

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

  it("renders the category image with correct src", () => {
    const { container } = render(<CategoryBlock category={mockCategory} />);
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", mockCategory.imageUrl);
  });
});
