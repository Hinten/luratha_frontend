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
  contactData: {
    phone: "(12) 98278-9225",
    phoneTel: "+5512982789225",
    whatsapp: "5512982789225",
    facebook: "https://facebook.com/Lurathaa",
    instagram: "https://instagram.com/_luratha",
    youtube: "https://youtube.com/channel/UC2RLNR2ZAzUxB97XYNFUnBg",
  },
  CATEGORIES: [
    { href: "/colecao/vestidos", label: "Vestidos" },
    { href: "/colecao/blusas", label: "Blusas" },
    { href: "/colecao/calcas", label: "Calças" },
    { href: "/colecao/saias", label: "Saias" },
    { href: "/colecao/conjuntos", label: "Conjuntos" },
    { href: "/colecao/acessorios", label: "Acessórios" },
  ],
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

  it("renders Sobre link", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Sobre" })).toBeInTheDocument();
  });

  it("renders Fale Conosco link", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Fale Conosco" })).toBeInTheDocument();
  });

  it("renders Política de Trocas link", () => {
    render(<Footer />);
    expect(
      screen.getByRole("link", { name: "Política de Trocas" })
    ).toBeInTheDocument();
  });

  it("renders Referência de Medidas link", () => {
    render(<Footer />);
    expect(
      screen.getByRole("link", { name: "Referência de Medidas" })
    ).toBeInTheDocument();
  });

  it("renders categories", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Vestidos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Blusas" })).toBeInTheDocument();
  });

  it("renders phone number", () => {
    render(<Footer />);
    expect(screen.getByText(/98278-9225/)).toBeInTheDocument();
  });

  it("renders WhatsApp link", () => {
    render(<Footer />);
    const waLink = screen.getByRole("link", { name: "WhatsApp" });
    expect(waLink).toBeInTheDocument();
    expect(waLink).toHaveAttribute("href", expect.stringContaining("wa.me"));
  });

  it("renders social media links", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Instagram" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Facebook" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "YouTube" })).toBeInTheDocument();
  });

  it("renders payment methods", () => {
    render(<Footer />);
    expect(screen.getByText("Pix")).toBeInTheDocument();
    expect(screen.getByText("Boleto")).toBeInTheDocument();
    expect(screen.getByText("Visa")).toBeInTheDocument();
    expect(screen.getByText("Mastercard")).toBeInTheDocument();
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
