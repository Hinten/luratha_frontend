import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PoliticaDePrivacidadePage from "@/src/app/politica-de-privacidade/page";

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

describe("PoliticaDePrivacidadePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the heading and LGPD sections", async () => {
    getSettingsMock.mockResolvedValueOnce({ company: EMPTY_COMPANY });

    render(await PoliticaDePrivacidadePage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Política de Privacidade" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /Seus direitos como titular/i }),
    ).toBeInTheDocument();
  });

  it("shows the configured DPO and legal name when company data is filled", async () => {
    getSettingsMock.mockResolvedValueOnce({
      company: {
        ...EMPTY_COMPANY,
        legalName: "Luratha Comércio LTDA",
        cnpj: "00.000.000/0001-00",
        dpoName: "Ana Encarregada",
        dpoEmail: "dpo@luratha.com.br",
      },
    });

    render(await PoliticaDePrivacidadePage());

    expect(screen.getByText(/Luratha Comércio LTDA/)).toBeInTheDocument();
    expect(screen.getByText(/Ana Encarregada/)).toBeInTheDocument();
    expect(screen.getByText(/dpo@luratha\.com\.br/)).toBeInTheDocument();
  });

  it("falls back to [INSERIR …] placeholders when company data is empty", async () => {
    getSettingsMock.mockResolvedValueOnce({ company: EMPTY_COMPANY });

    render(await PoliticaDePrivacidadePage());

    expect(screen.getByText(/\[INSERIR RAZÃO SOCIAL\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[INSERIR NOME DO ENCARREGADO\]/)).toBeInTheDocument();
  });
});
