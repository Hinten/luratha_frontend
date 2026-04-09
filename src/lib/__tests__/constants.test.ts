import { describe, it, expect } from "vitest";
import { appData, CATEGORIES } from "@/src/lib/constants";

describe("appData constants", () => {
  it("has the correct app name", () => {
    expect(appData.name).toBe("Luratha");
  });

  it("has the correct logo path", () => {
    expect(appData.logo).toBe("/luratha.svg");
  });

  it("exports all required fields", () => {
    expect(appData).toHaveProperty("name");
    expect(appData).toHaveProperty("logo");
  });
});

describe("CATEGORIES", () => {
  it("exports an array of categories", () => {
    expect(Array.isArray(CATEGORIES)).toBe(true);
    expect(CATEGORIES.length).toBe(8);
  });

  it("every category has a slug and a label", () => {
    CATEGORIES.forEach((cat) => {
      expect(cat).toHaveProperty("slug");
      expect(cat).toHaveProperty("label");
      expect(typeof cat.slug).toBe("string");
      expect(typeof cat.label).toBe("string");
    });
  });

  it("contains all expected slugs", () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(slugs).toContain("vestidos");
    expect(slugs).toContain("blusas");
    expect(slugs).toContain("calcas");
    expect(slugs).toContain("saias");
    expect(slugs).toContain("shorts");
    expect(slugs).toContain("conjuntos");
    expect(slugs).toContain("moletons");
    expect(slugs).toContain("acessorios");
  });

  it("all slugs are unique", () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });
});
