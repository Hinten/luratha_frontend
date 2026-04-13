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

/* Default mocks for contexts — override per test where needed */
vi.mock("@/src/contexts/CartContext", () => ({
  useCart: () => ({
    items: [],
    totalItems: 0,
    totalPrice: 0,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
  }),
}));

vi.mock("@/src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
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

  it("renders the cart link pointing to /carrinho", () => {
    render(<Header />);
    const cartLink = screen.getByRole("link", { name: "Carrinho" });
    expect(cartLink).toBeInTheDocument();
    expect(cartLink).toHaveAttribute("href", "/carrinho");
  });

  it("does not render a cart badge when cart is empty", () => {
    render(<Header />);
    // totalItems is 0 in the mock → no badge rendered
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders the Entrar link when not authenticated", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Entrar" })).toBeInTheDocument();
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

  it("shows Entrar and Cadastrar links in mobile menu when not authenticated", () => {
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    // Both desktop (aria-label) and mobile links are in DOM — at least one "Entrar" link
    expect(screen.getAllByRole("link", { name: "Entrar" }).length).toBeGreaterThanOrEqual(1);
    // Cadastrar only appears in the mobile menu
    expect(screen.getByRole("link", { name: "Cadastrar" })).toBeInTheDocument();
  });
});

