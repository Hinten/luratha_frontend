import { describe, it, expect, beforeEach, vi } from "vitest";
import { markProductViewed, wasProductViewedRecently } from "@/src/hooks/useRecentlyViewed";

describe("useRecentlyViewed", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns false for a slug that was never viewed", () => {
    expect(wasProductViewedRecently("vestido-floral")).toBe(false);
  });

  it("returns true immediately after marking a product as viewed", () => {
    markProductViewed("vestido-floral");
    expect(wasProductViewedRecently("vestido-floral")).toBe(true);
  });

  it("returns false for a different slug after marking another", () => {
    markProductViewed("vestido-floral");
    expect(wasProductViewedRecently("conjunto-crochet")).toBe(false);
  });

  it("returns false when the timestamp is older than 24h", () => {
    markProductViewed("vestido-floral");
    const twentyFiveHoursMs = 25 * 60 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + twentyFiveHoursMs);
    expect(wasProductViewedRecently("vestido-floral")).toBe(false);
  });

  it("persists multiple slugs independently", () => {
    markProductViewed("vestido-floral");
    markProductViewed("conjunto-crochet");
    expect(wasProductViewedRecently("vestido-floral")).toBe(true);
    expect(wasProductViewedRecently("conjunto-crochet")).toBe(true);
  });

  it("updates the timestamp when the same slug is marked again", () => {
    markProductViewed("vestido-floral");
    const first = (
      JSON.parse(localStorage.getItem("luratha_viewed_products")!) as Record<string, number>
    )["vestido-floral"];
    markProductViewed("vestido-floral");
    const second = (
      JSON.parse(localStorage.getItem("luratha_viewed_products")!) as Record<string, number>
    )["vestido-floral"];
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it("does not throw when localStorage rejects writes (QuotaExceededError)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    expect(() => markProductViewed("vestido-floral")).not.toThrow();
  });

  it("rethrows unexpected errors from localStorage (not DOMException)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("totally unrelated bug");
    });
    expect(() => markProductViewed("vestido-floral")).toThrow("totally unrelated bug");
  });
});
