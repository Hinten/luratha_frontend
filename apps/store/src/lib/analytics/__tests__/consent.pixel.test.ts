import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setConsentChoice } from "@/src/lib/analytics/consent";

// `setConsentChoice` agora dirige GA4 (gtag) e Meta Pixel (fbq) com uma única
// escolha. Aqui validamos o lado do Pixel; o lado GA4 vive em consent.ga4.test.
let fbq: ReturnType<typeof vi.fn>;
let gtag: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fbq = vi.fn();
  gtag = vi.fn();
  vi.stubGlobal("fbq", fbq);
  vi.stubGlobal("gtag", gtag);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("setConsentChoice → Meta Pixel consent", () => {
  it("issues fbq consent revoke when the visitor opts out", () => {
    setConsentChoice("denied");
    expect(fbq).toHaveBeenCalledWith("consent", "revoke");
  });

  it("issues fbq consent grant when the visitor opts back in", () => {
    setConsentChoice("denied");
    setConsentChoice("granted");
    expect(fbq).toHaveBeenLastCalledWith("consent", "grant");
  });
});
