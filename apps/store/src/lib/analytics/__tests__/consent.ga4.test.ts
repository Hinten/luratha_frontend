import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readConsentChoice, setConsentChoice } from "@/src/lib/analytics/consent";
import { GA_CONSENT_STORAGE_KEY } from "@/src/lib/analytics/gtag";

const DENIED_SIGNALS = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
};
const GRANTED_SIGNALS = {
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
  analytics_storage: "granted",
};

let gtag: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  gtag = vi.fn();
  vi.stubGlobal("gtag", gtag);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("readConsentChoice", () => {
  it("returns null when no explicit choice is stored (default granted applies)", () => {
    expect(readConsentChoice()).toBeNull();
    // Reading must never trigger a consent update.
    expect(gtag).not.toHaveBeenCalled();
  });

  it("returns the stored 'denied' / 'granted' value", () => {
    localStorage.setItem(GA_CONSENT_STORAGE_KEY, "denied");
    expect(readConsentChoice()).toBe("denied");
    localStorage.setItem(GA_CONSENT_STORAGE_KEY, "granted");
    expect(readConsentChoice()).toBe("granted");
  });

  it("treats junk values as no choice", () => {
    localStorage.setItem(GA_CONSENT_STORAGE_KEY, "maybe");
    expect(readConsentChoice()).toBeNull();
  });

  it("tolerates localStorage throwing a DOMException", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(readConsentChoice()).toBeNull();
  });
});

describe("setConsentChoice", () => {
  it("persists 'denied' and issues a consent update with all signals denied", () => {
    setConsentChoice("denied");
    expect(localStorage.getItem(GA_CONSENT_STORAGE_KEY)).toBe("denied");
    expect(gtag).toHaveBeenCalledWith("consent", "update", DENIED_SIGNALS);
  });

  it("persists 'granted' and issues a consent update with all signals granted (revert)", () => {
    setConsentChoice("denied");
    setConsentChoice("granted");
    expect(localStorage.getItem(GA_CONSENT_STORAGE_KEY)).toBe("granted");
    expect(gtag).toHaveBeenLastCalledWith("consent", "update", GRANTED_SIGNALS);
  });

  it("still issues the consent update when persistence throws a DOMException", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    setConsentChoice("denied");
    expect(gtag).toHaveBeenCalledWith("consent", "update", DENIED_SIGNALS);
  });
});
