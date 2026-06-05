import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SortDropdown, { SORT_OPTIONS } from "@/src/components/categoria/SortDropdown";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/categoria/vestidos",
  useSearchParams: () => new URLSearchParams(),
}));

describe("SortDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sort label", () => {
    render(<SortDropdown />);
    expect(screen.getByText("Ordenar por:")).toBeInTheDocument();
  });

  it("renders a select element with all sort options", () => {
    render(<SortDropdown />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    SORT_OPTIONS.forEach(({ label }) => {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    });
  });

  it("defaults to 'recentes' when no currentSort is passed", () => {
    render(<SortDropdown />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("recentes");
  });

  it("reflects the currentSort prop as the selected option", () => {
    render(<SortDropdown currentSort="menor-preco" />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("menor-preco");
  });

  it("calls router.push with the sort param when a new option is selected", () => {
    render(<SortDropdown />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "maior-preco" } });
    expect(mockPush).toHaveBeenCalledWith("/categoria/vestidos?sort=maior-preco");
  });

  it("removes the sort param when 'recentes' is selected", () => {
    render(<SortDropdown currentSort="recentes" />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "recentes" } });
    // top-level mock returns empty URLSearchParams, so query is empty → bare path
    expect(mockPush).toHaveBeenCalledWith("/categoria/vestidos");
  });
});
