import { describe, it, expect, afterEach, vi } from "vitest";
import { trackEvent, updateConsent, pageview, getGaClientId } from "@/src/lib/analytics/gtag";

/** Remove o cookie `_ga` (jsdom acumula cookies entre testes). */
function clearGaCookie() {
  document.cookie = "_ga=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearGaCookie();
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

  describe("getGaClientId", () => {
    it("extracts the client_id from the _ga cookie (everything after the 2nd dot)", () => {
      document.cookie = "_ga=GA1.1.1234567890.987654321; path=/";
      expect(getGaClientId()).toBe("1234567890.987654321");
    });

    it("reads _ga among other cookies", () => {
      document.cookie = "foo=bar; path=/";
      document.cookie = "_ga=GA1.2.111.222; path=/";
      document.cookie = "_ga_ABC=GS1.1.xyz; path=/";
      expect(getGaClientId()).toBe("111.222");
    });

    it("returns null when the _ga cookie is absent", () => {
      expect(getGaClientId()).toBeNull();
    });

    it("returns null for a malformed _ga value", () => {
      document.cookie = "_ga=not-a-ga-cookie; path=/";
      expect(getGaClientId()).toBeNull();
    });
  });
});
