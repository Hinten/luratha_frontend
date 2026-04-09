import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "@/src/components/Footer";

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

vi.mock("@/src/lib/constants", () => ({
  appData: { name: "Luratha", logo: "/luratha.svg" },
}));

describe("Footer", () => {
  it("renders the logo image with correct alt text", () => {
    render(<Footer />);
    const logo = screen.getByAltText("Luratha");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/luratha.svg");
  });

  it("renders the logo link pointing to the homepage", () => {
    render(<Footer />);
    const links = screen.getAllByRole("link");
    const homeLink = links.find((el) => el.getAttribute("href") === "/");
    expect(homeLink).toBeInTheDocument();
  });

  it("renders all navigation links", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Coleção" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sobre" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contato" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacidade" })).toBeInTheDocument();
  });

  it("renders copyright with the app name", () => {
    render(<Footer />);
    expect(screen.getByText(/Luratha/)).toBeInTheDocument();
    expect(screen.getByText(/Todos os direitos reservados/)).toBeInTheDocument();
  });

  it("renders copyright with the current year", () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });
});
