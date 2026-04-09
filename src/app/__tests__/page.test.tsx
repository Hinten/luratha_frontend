import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/src/app/page";

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

// HeroBanner uses useEffect/useState — mock it to avoid timer issues in tests
vi.mock("@/src/components/HeroBanner", () => ({
  default: () => <section aria-label="Banner principal"><h1>Peças feitas com amor para durar</h1></section>,
}));

describe("Home page", () => {
  it("renders the hero banner", () => {
    render(<Home />);
    expect(screen.getByRole("region", { name: "Banner principal" })).toBeInTheDocument();
  });

  it("renders the category section heading", () => {
    render(<Home />);
    expect(screen.getByText("Explore por categoria")).toBeInTheDocument();
  });

  it("renders Lançamentos section", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Lançamentos" })).toBeInTheDocument();
  });

  it("renders Destaques section", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Destaques" })).toBeInTheDocument();
  });

  it("renders Sale section", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "SALE até 50% OFF" })).toBeInTheDocument();
  });

  it("renders category links for Vestidos, Blusas, Calças", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Vestidos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Blusas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Calças" })).toBeInTheDocument();
  });

  it("renders view-all link for Lançamentos", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Ver todos os lançamentos" })).toBeInTheDocument();
  });

  it("renders link to /sale", () => {
    render(<Home />);
    const saleLinks = screen.getAllByRole("link", { name: "Ver ofertas" });
    expect(saleLinks.length).toBeGreaterThan(0);
    expect(saleLinks[0]).toHaveAttribute("href", "/sale");
  });
});
