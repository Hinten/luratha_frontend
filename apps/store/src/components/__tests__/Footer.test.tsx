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
    phone: "(11) 99999-9999",
    phoneTel: "+5511999999999",
    whatsapp: "5511999999999",
    facebook: "https://facebook.com/Lurathaa",
    instagram: "https://instagram.com/_luratha",
    youtube: "https://youtube.com/channel/UC2RLNR2ZAzUxB97XYNFUnBg",
  },
}));

vi.mock("@/src/lib/queries/getCachedCategories", () => ({
  getCachedCategories: vi.fn().mockResolvedValue([
    { id: "cat_vestidos", name: "Vestidos", slug: "vestidos" },
    { id: "cat_blusas", name: "Blusas", slug: "blusas" },
    { id: "cat_calcas", name: "Calças", slug: "calcas" },
    { id: "cat_saias", name: "Saias", slug: "saias" },
    { id: "cat_conjuntos", name: "Conjuntos", slug: "conjuntos" },
    { id: "cat_acessorios", name: "Acessórios", slug: "acessorios" },
  ]),
}));

describe("Footer", () => {
  it("renders the logo image with correct alt text", async () => {
    render(await Footer());
    const logo = screen.getByAltText("Luratha");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/luratha.svg");
  });

  it("renders the logo link pointing to the homepage", async () => {
    render(await Footer());
    const links = screen.getAllByRole("link");
    const homeLink = links.find((el) => el.getAttribute("href") === "/");
    expect(homeLink).toBeInTheDocument();
  });

  it("renders Sobre link", async () => {
    render(await Footer());
    expect(screen.getByRole("link", { name: "Sobre" })).toBeInTheDocument();
  });

  it("renders Fale Conosco link", async () => {
    render(await Footer());
    expect(screen.getByRole("link", { name: "Fale Conosco" })).toBeInTheDocument();
  });

  it("renders Política de Trocas link", async () => {
    render(await Footer());
    expect(screen.getByRole("link", { name: "Política de Trocas" })).toBeInTheDocument();
  });

  it("renders Referência de Medidas link", async () => {
    render(await Footer());
    expect(screen.getByRole("link", { name: "Referência de Medidas" })).toBeInTheDocument();
  });

  it("renders categories", async () => {
    render(await Footer());
    expect(screen.getByRole("link", { name: "Vestidos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Blusas" })).toBeInTheDocument();
  });

  it("renders phone number", async () => {
    render(await Footer());
    expect(screen.getByText(/99999-9999/)).toBeInTheDocument();
  });

  it("renders WhatsApp link", async () => {
    render(await Footer());
    const waLink = screen.getByRole("link", { name: "WhatsApp" });
    expect(waLink).toBeInTheDocument();
    expect(waLink).toHaveAttribute("href", expect.stringContaining("wa.me"));
  });

  it("renders social media links", async () => {
    render(await Footer());
    expect(screen.getByRole("link", { name: "Instagram" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Facebook" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "YouTube" })).toBeInTheDocument();
  });

  it("renders payment methods", async () => {
    render(await Footer());
    expect(screen.getByText("Pix")).toBeInTheDocument();
    expect(screen.getByText("Boleto")).toBeInTheDocument();
    expect(screen.getByText("Visa")).toBeInTheDocument();
    expect(screen.getByText("Mastercard")).toBeInTheDocument();
  });

  it("renders copyright with the app name", async () => {
    render(await Footer());
    expect(screen.getByText(/Luratha/)).toBeInTheDocument();
    expect(screen.getByText(/Todos os direitos reservados/)).toBeInTheDocument();
  });

  it("renders copyright with the current year", async () => {
    render(await Footer());
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });
});
