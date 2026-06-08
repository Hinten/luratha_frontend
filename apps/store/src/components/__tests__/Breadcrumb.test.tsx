import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Breadcrumb from "@/src/components/Breadcrumb";

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

describe("Breadcrumb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the nav landmark with label Breadcrumb", () => {
    render(<Breadcrumb items={[{ label: "Home", href: "/" }]} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("renders a single item without a link (current page)", () => {
    render(<Breadcrumb items={[{ label: "Vestidos" }]} />);
    expect(screen.getByText("Vestidos")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders linked items as anchor tags", () => {
    render(<Breadcrumb items={[{ label: "Home", href: "/" }]} />);
    const link = screen.getByRole("link", { name: "Home" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders multiple items", () => {
    render(<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Vestidos" }]} />);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByText("Vestidos")).toBeInTheDocument();
  });

  it("marks the last item as current page", () => {
    render(<Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Vestidos" }]} />);
    const current = screen.getByText("Vestidos");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("renders the schema.org structured data script", () => {
    const { container } = render(
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Vestidos" }]} />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data.itemListElement).toHaveLength(2);
  });
});
