import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Header from "@/src/components/Header";

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

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the logo image with correct alt text", () => {
    render(<Header />);
    const logo = screen.getByAltText("Luratha");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/luratha.svg");
  });

  it("renders the logo link pointing to the homepage", () => {
    render(<Header />);
    const logoLink = screen
      .getAllByRole("link")
      .find((el) => el.getAttribute("href") === "/");
    expect(logoLink).toBeInTheDocument();
  });

  it("renders desktop navigation links", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Coleção" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sobre" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contato" })).toBeInTheDocument();
  });

  it("renders the cart button", () => {
    render(<Header />);
    expect(
      screen.getByRole("button", { name: "Carrinho" })
    ).toBeInTheDocument();
  });

  it("renders the hamburger menu button", () => {
    render(<Header />);
    expect(
      screen.getByRole("button", { name: "Abrir menu" })
    ).toBeInTheDocument();
  });

  it("toggles the mobile menu when hamburger button is clicked", () => {
    render(<Header />);
    const hamburger = screen.getByRole("button", { name: "Abrir menu" });

    fireEvent.click(hamburger);

    expect(screen.getByRole("button", { name: "Fechar menu" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Coleção" }).length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
    expect(screen.getByRole("button", { name: "Abrir menu" })).toBeInTheDocument();
  });

  it("closes the mobile menu when a nav link is clicked", () => {
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    const mobileLinks = screen.getAllByRole("link", { name: "Coleção" });
    const mobileLink = mobileLinks[mobileLinks.length - 1];
    fireEvent.click(mobileLink);

    expect(screen.getByRole("button", { name: "Abrir menu" })).toBeInTheDocument();
  });
});
