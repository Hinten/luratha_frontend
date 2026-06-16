import { describe, it, expect, afterEach, vi } from "vitest";
import { trackPixelEvent, pixelPageview, updatePixelConsent } from "@/src/lib/analytics/fbq";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fbq helpers", () => {
  describe("trackPixelEvent", () => {
    it("is a silent no-op when window.fbq is absent", () => {
      expect(() => trackPixelEvent("ViewContent", { value: 1 })).not.toThrow();
    });

    it("forwards the event name and params to fbq", () => {
      const fbq = vi.fn();
      vi.stubGlobal("fbq", fbq);
      trackPixelEvent("AddToCart", { currency: "BRL", value: 10 });
      expect(fbq).toHaveBeenCalledWith("track", "AddToCart", { currency: "BRL", value: 10 });
    });

    it("defaults params to an empty object", () => {
      const fbq = vi.fn();
      vi.stubGlobal("fbq", fbq);
      trackPixelEvent("ViewContent");
      expect(fbq).toHaveBeenCalledWith("track", "ViewContent", {});
    });

    it("passes eventID as the 4th argument when provided (CAPI dedupe)", () => {
      const fbq = vi.fn();
      vi.stubGlobal("fbq", fbq);
      trackPixelEvent("Purchase", { value: 99 }, { eventID: "order_123" });
      expect(fbq).toHaveBeenCalledWith(
        "track",
        "Purchase",
        { value: 99 },
        { eventID: "order_123" },
      );
    });

    it("omits the options arg when eventID is empty", () => {
      const fbq = vi.fn();
      vi.stubGlobal("fbq", fbq);
      trackPixelEvent("Purchase", { value: 99 }, { eventID: "" });
      expect(fbq).toHaveBeenCalledWith("track", "Purchase", { value: 99 });
    });
  });

  describe("pixelPageview", () => {
    it("sends a PageView track", () => {
      const fbq = vi.fn();
      vi.stubGlobal("fbq", fbq);
      pixelPageview();
      expect(fbq).toHaveBeenCalledWith("track", "PageView");
    });

    it("is a no-op without fbq", () => {
      expect(() => pixelPageview()).not.toThrow();
    });
  });

  describe("updatePixelConsent", () => {
    it("maps granted → grant and denied → revoke", () => {
      const fbq = vi.fn();
      vi.stubGlobal("fbq", fbq);
      updatePixelConsent("granted");
      expect(fbq).toHaveBeenCalledWith("consent", "grant");
      updatePixelConsent("denied");
      expect(fbq).toHaveBeenLastCalledWith("consent", "revoke");
    });

    it("is a no-op without fbq", () => {
      expect(() => updatePixelConsent("denied")).not.toThrow();
    });
  });
});
