import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WhatsAppButton from "@/src/components/WhatsAppButton";

vi.mock("@/src/lib/constants", () => ({
  contactData: {
    phone: "(11) 99999-9999",
    phoneTel: "+5511999999999",
    whatsapp: "5511999999999",
    facebook: "https://facebook.com/Lurathaa",
    instagram: "https://instagram.com/_luratha",
    youtube: "https://youtube.com/channel/UC2RLNR2ZAzUxB97XYNFUnBg",
  },
}));

describe("WhatsAppButton", () => {
  it("renders a link with aria-label 'Falar no WhatsApp'", () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole("link", { name: "Falar no WhatsApp" });
    expect(link).toBeInTheDocument();
  });

  it("has correct WhatsApp href", () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole("link", { name: "Falar no WhatsApp" });
    expect(link).toHaveAttribute("href", expect.stringContaining("wa.me/5511999999999"));
  });

  it("includes pre-filled message in the URL", () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole("link", { name: "Falar no WhatsApp" });
    expect(link).toHaveAttribute("href", expect.stringContaining("text="));
  });

  it("opens in a new tab", () => {
    render(<WhatsAppButton />);
    const link = screen.getByRole("link", { name: "Falar no WhatsApp" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the WhatsApp SVG icon", () => {
    render(<WhatsAppButton />);
    const svg = document.querySelector("svg[aria-hidden='true']");
    expect(svg).toBeInTheDocument();
  });
});
