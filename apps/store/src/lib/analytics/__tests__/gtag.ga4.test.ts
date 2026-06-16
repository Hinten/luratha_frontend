import { describe, it, expect, afterEach, vi } from "vitest";
import { trackEvent, updateConsent, pageview } from "@/src/lib/analytics/gtag";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gtag helpers", () => {
  describe("trackEvent", () => {
    it("is a silent no-op when window.gtag is absent", () => {
      expect(() => trackEvent("view_item", { foo: "bar" })).not.toThrow();
    });

    it("forwards the event name and params to gtag", () => {
      const gtag = vi.fn();
      vi.stubGlobal("gtag", gtag);
      trackEvent("add_to_cart", { currency: "BRL", value: 10 });
      expect(gtag).toHaveBeenCalledWith("event", "add_to_cart", { currency: "BRL", value: 10 });
    });

    it("defaults params to an empty object", () => {
      const gtag = vi.fn();
      vi.stubGlobal("gtag", gtag);
      trackEvent("page_view");
      expect(gtag).toHaveBeenCalledWith("event", "page_view", {});
    });
  });

  describe("updateConsent", () => {
    it("issues a consent update with the provided signals", () => {
      const gtag = vi.fn();
      vi.stubGlobal("gtag", gtag);
      updateConsent({
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      });
      expect(gtag).toHaveBeenCalledWith("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      });
    });

    it("is a no-op without gtag", () => {
      expect(() =>
        updateConsent({
          ad_storage: "granted",
          ad_user_data: "granted",
          ad_personalization: "granted",
          analytics_storage: "granted",
        }),
      ).not.toThrow();
    });
  });

  describe("pageview", () => {
    it("sends a page_view event with path, location and title", () => {
      const gtag = vi.fn();
      vi.stubGlobal("gtag", gtag);
      document.title = "Página de Teste";
      pageview("/produto/abc?x=1");
      expect(gtag).toHaveBeenCalledWith("event", "page_view", {
        page_path: "/produto/abc?x=1",
        page_location: window.location.href,
        page_title: "Página de Teste",
      });
    });
  });
});
