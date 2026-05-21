import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Spinner from "@/src/components/Spinner";

describe("Spinner", () => {
  it("renderiza um SVG com aria-hidden", () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("respeita o prop size (default 16)", () => {
    const { container, rerender } = render(<Spinner />);
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("16");
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("16");

    rerender(<Spinner size={24} />);
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("24");
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("24");
  });

  it("mescla className customizado", () => {
    const { container } = render(<Spinner className="extra-class" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("extra-class");
  });
});
