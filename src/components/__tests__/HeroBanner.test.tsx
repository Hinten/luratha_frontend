import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import HeroBanner from "@/src/components/HeroBanner";

describe("HeroBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the banner section", () => {
    render(<HeroBanner />);
    expect(screen.getByRole("region", { name: "Banner principal" })).toBeInTheDocument();
  });

  it("renders the first slide title", () => {
    render(<HeroBanner />);
    expect(
      screen.getByText("Peças feitas com amor para durar")
    ).toBeInTheDocument();
  });

  it("renders navigation dots", () => {
    render(<HeroBanner />);
    expect(screen.getByRole("button", { name: "Ir para slide 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para slide 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para slide 3" })).toBeInTheDocument();
  });

  it("renders prev/next buttons", () => {
    render(<HeroBanner />);
    expect(screen.getByRole("button", { name: "Slide anterior" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próximo slide" })).toBeInTheDocument();
  });

  it("advances to next slide when next button is clicked", () => {
    render(<HeroBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Próximo slide" }));
    expect(screen.getByText("Novas chegadas")).toBeInTheDocument();
  });

  it("goes back to previous slide when prev button is clicked", () => {
    render(<HeroBanner />);
    // Advance to slide 2 first
    fireEvent.click(screen.getByRole("button", { name: "Próximo slide" }));
    // Then go back
    fireEvent.click(screen.getByRole("button", { name: "Slide anterior" }));
    expect(screen.getByText("Peças feitas com amor para durar")).toBeInTheDocument();
  });

  it("navigates to a specific slide when a dot is clicked", () => {
    render(<HeroBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Ir para slide 3" }));
    expect(screen.getByText("SALE até 50% OFF")).toBeInTheDocument();
  });

  it("auto-advances slide after 5 seconds", () => {
    render(<HeroBanner />);
    expect(screen.getByText("Peças feitas com amor para durar")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("Novas chegadas")).toBeInTheDocument();
  });

  it("renders CTA link on first slide", () => {
    render(<HeroBanner />);
    const cta = screen.getByRole("link", { name: /Explorar coleção/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute("href", "/colecao");
  });
});
