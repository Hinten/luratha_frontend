import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/src/app/page";

describe("Home page", () => {
  it("renders the Home heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
  });
});

