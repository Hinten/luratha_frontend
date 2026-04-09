import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/src/app/page";

vi.mock("@/src/components/SobrePage", () => ({
  default: () => <div>SobrePage</div>,
}));
vi.mock("@/src/components/ContatoPage", () => ({
  default: () => <div>ContatoPage</div>,
}));
vi.mock("@/src/components/PoliticaDeTrocasPage", () => ({
  default: () => <div>PoliticaDeTrocasPage</div>,
}));
vi.mock("@/src/components/ReferenciaDeMedidasPage", () => ({
  default: () => <div>ReferenciaDeMedidasPage</div>,
}));

describe("Home page", () => {
  it("renders the Home heading by default", async () => {
    const searchParams = Promise.resolve({});
    render(await Home({ searchParams }));
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
  });

  it("renders SobrePage when _page=sobre", async () => {
    const searchParams = Promise.resolve({ _page: "sobre" });
    render(await Home({ searchParams }));
    expect(screen.getByText("SobrePage")).toBeInTheDocument();
  });

  it("renders ContatoPage when _page=contato", async () => {
    const searchParams = Promise.resolve({ _page: "contato" });
    render(await Home({ searchParams }));
    expect(screen.getByText("ContatoPage")).toBeInTheDocument();
  });

  it("renders PoliticaDeTrocasPage when _page=politica-de-trocas", async () => {
    const searchParams = Promise.resolve({ _page: "politica-de-trocas" });
    render(await Home({ searchParams }));
    expect(screen.getByText("PoliticaDeTrocasPage")).toBeInTheDocument();
  });

  it("renders ReferenciaDeMedidasPage when _page=referencia-de-medidas", async () => {
    const searchParams = Promise.resolve({ _page: "referencia-de-medidas" });
    render(await Home({ searchParams }));
    expect(screen.getByText("ReferenciaDeMedidasPage")).toBeInTheDocument();
  });
});
