import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TermosDeUsoPage from "@/src/app/termos-de-uso/page";

const { getSettingsMock } = vi.hoisted(() => ({
  getSettingsMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/src/components/JsonLd", () => ({
  default: () => null,
}));

vi.mock("@/src/lib/queries/getCachedSiteSettings", () => ({
  getCachedSiteSettings: getSettingsMock,
}));

const EMPTY_COMPANY = {
  legalName: "",
  tradeName: "",
  cnpj: "",
  dpoName: "",
  dpoEmail: "",
  contactEmail: "",
  addressLine: "",
  addressCity: "",
  addressState: "",
  jurisdiction: "",
};

describe("TermosDeUsoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the heading and the jurisdiction clause", async () => {
    getSettingsMock.mockResolvedValueOnce({ company: EMPTY_COMPANY });

    render(await TermosDeUsoPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Termos de Uso" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /Lei aplicável e foro/i }),
    ).toBeInTheDocument();
  });

  it("shows the configured legal name, CNPJ and jurisdiction when filled", async () => {
    getSettingsMock.mockResolvedValueOnce({
      company: {
        ...EMPTY_COMPANY,
        legalName: "Luratha Comércio LTDA",
        cnpj: "00.000.000/0001-00",
        jurisdiction: "São Paulo/SP",
      },
    });

    render(await TermosDeUsoPage());

    expect(screen.getByText(/Luratha Comércio LTDA/)).toBeInTheDocument();
    expect(screen.getByText(/00\.000\.000\/0001-00/)).toBeInTheDocument();
    expect(screen.getByText(/São Paulo\/SP/)).toBeInTheDocument();
  });

  it("falls back to [INSERIR …] placeholders when company data is empty", async () => {
    getSettingsMock.mockResolvedValueOnce({ company: EMPTY_COMPANY });

    render(await TermosDeUsoPage());

    expect(screen.getByText(/\[INSERIR RAZÃO SOCIAL\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[INSERIR COMARCA\/FORO\]/)).toBeInTheDocument();
  });
});
