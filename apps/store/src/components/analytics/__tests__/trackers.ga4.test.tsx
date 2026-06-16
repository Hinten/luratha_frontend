import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StrictMode } from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import ViewItemTracker from "@/src/components/analytics/ViewItemTracker";
import ViewItemListTracker from "@/src/components/analytics/ViewItemListTracker";
import SelectItemTracker from "@/src/components/analytics/SelectItemTracker";
import PageViewTracker from "@/src/components/analytics/PageViewTracker";
import { buildProductSlug, validateProduct, type Product } from "@luratha/schemas";

// next/navigation controlável: testes mutam `navState` e fazem rerender para
// simular navegação (mudança de path) vs. mudança só de query string.
const navState = { pathname: "/", search: "" };
vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
  useSearchParams: () => new URLSearchParams(navState.search),
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return validateProduct({
    id: "prod_1",
    title: "Vestido Bordado Floral",
    slug: buildProductSlug("Vestido Bordado Floral", "LURATHA_9001"),
    description: "Descrição",
    sku: "LURATHA_9001",
    status: "active",
    isPurchasable: true,
    brandName: "Luratha",
    categoryId: "cat_vestidos",
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: { price: 289, salePrice: null, priceMin: 289, priceMax: 289, currency: "BRL" },
    photoAssets: [],
    lifeStylePhotos: [],
    totalStock: 10,
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  });
}

let gtag: ReturnType<typeof vi.fn>;

function eventNames() {
  return gtag.mock.calls.filter((c) => c[0] === "event").map((c) => c[1]);
}

beforeEach(() => {
  gtag = vi.fn();
  vi.stubGlobal("gtag", gtag);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function count(name: string) {
  return eventNames().filter((n) => n === name).length;
}

describe("ViewItemTracker", () => {
  it("fires view_item on mount", () => {
    render(<ViewItemTracker product={makeProduct()} />);
    expect(eventNames()).toContain("view_item");
    const call = gtag.mock.calls.find((c) => c[1] === "view_item");
    expect(call?.[2]).toMatchObject({ currency: "BRL", value: 289 });
  });

  it("fires view_item only once under StrictMode (no double-fire)", () => {
    render(
      <StrictMode>
        <ViewItemTracker product={makeProduct()} />
      </StrictMode>,
    );
    expect(count("view_item")).toBe(1);
  });
});

describe("ViewItemListTracker", () => {
  it("fires view_item_list on mount with the list name", () => {
    const a = makeProduct({
      id: "p1",
      title: "Peça A",
      sku: "LURATHA_1",
      slug: buildProductSlug("Peça A", "LURATHA_1"),
    });
    const b = makeProduct({
      id: "p2",
      title: "Peça B",
      sku: "LURATHA_2",
      slug: buildProductSlug("Peça B", "LURATHA_2"),
    });
    render(<ViewItemListTracker products={[a, b]} listName="Vestidos" />);
    const call = gtag.mock.calls.find((c) => c[1] === "view_item_list");
    expect(call?.[2]).toMatchObject({ item_list_name: "Vestidos" });
    expect((call?.[2] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("does not fire when the product list is empty", () => {
    render(<ViewItemListTracker products={[]} />);
    expect(eventNames()).not.toContain("view_item_list");
  });

  it("fires view_item_list only once under StrictMode (no double-fire)", () => {
    render(
      <StrictMode>
        <ViewItemListTracker products={[makeProduct()]} listName="Vestidos" />
      </StrictMode>,
    );
    expect(count("view_item_list")).toBe(1);
  });
});

describe("PageViewTracker", () => {
  it("fires page_view on the initial path and again only when the path changes", () => {
    navState.pathname = "/categoria/vestidos";
    navState.search = "";
    const { rerender } = render(<PageViewTracker />);
    expect(count("page_view")).toBe(1);

    // Mudança só de query (filtro/sort) NÃO gera um novo page_view.
    navState.search = "sort=menor-preco";
    rerender(<PageViewTracker />);
    expect(count("page_view")).toBe(1);

    // Mudança de path gera um novo page_view.
    navState.pathname = "/categoria/blusas";
    rerender(<PageViewTracker />);
    expect(count("page_view")).toBe(2);
  });

  it("does not fire twice under StrictMode for the same path", () => {
    navState.pathname = "/checkout";
    navState.search = "";
    render(
      <StrictMode>
        <PageViewTracker />
      </StrictMode>,
    );
    expect(count("page_view")).toBe(1);
  });
});

describe("SelectItemTracker", () => {
  it("fires select_item with the list name and index when a card link is clicked", () => {
    render(
      <SelectItemTracker product={makeProduct()} listName="Vestidos" index={2}>
        {/* `<a>` sem href: evita a navegação não implementada do jsdom, mas
            ainda casa com o closest("a") do tracker. */}
        <a data-testid="card-link">Ver produto</a>
        <button type="button" data-testid="fav">
          ♡
        </button>
      </SelectItemTracker>,
    );
    fireEvent.click(screen.getByTestId("card-link"));
    const call = gtag.mock.calls.find((c) => c[1] === "select_item");
    expect(call?.[2]).toMatchObject({ item_list_name: "Vestidos" });
    expect((call?.[2] as { items: { index: number }[] }).items[0].index).toBe(2);
  });

  it("does not fire select_item when a non-link control is clicked", () => {
    render(
      <SelectItemTracker product={makeProduct()}>
        <a data-testid="card-link">Ver produto</a>
        <button type="button" data-testid="fav">
          ♡
        </button>
      </SelectItemTracker>,
    );
    fireEvent.click(screen.getByTestId("fav"));
    expect(eventNames()).not.toContain("select_item");
  });
});
