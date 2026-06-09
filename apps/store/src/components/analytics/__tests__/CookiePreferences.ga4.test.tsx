import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CookiePreferences from "@/src/components/analytics/CookiePreferences";
import { GA_CONSENT_STORAGE_KEY } from "@/src/lib/analytics/gtag";

let gtag: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  gtag = vi.fn();
  vi.stubGlobal("gtag", gtag);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CookiePreferences", () => {
  it("shows the active state and a 'Recusar' action when no choice is stored", async () => {
    render(<CookiePreferences />);
    expect(
      await screen.findByRole("button", { name: /recusar análise e anúncios/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/medição.*ativa/i);
  });

  it("opt-out: 'Recusar' persists denied, fires consent update, and flips to 'Permitir'", async () => {
    const user = userEvent.setup();
    render(<CookiePreferences />);

    const recusar = await screen.findByRole("button", { name: /recusar análise e anúncios/i });
    await user.click(recusar);

    expect(localStorage.getItem(GA_CONSENT_STORAGE_KEY)).toBe("denied");
    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
    expect(
      screen.getByRole("button", { name: /permitir análise e anúncios/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/recusou/i);
  });

  it("revert: 'Permitir' persists granted and fires consent update granted", async () => {
    const user = userEvent.setup();
    localStorage.setItem(GA_CONSENT_STORAGE_KEY, "denied");
    render(<CookiePreferences />);

    const permitir = await screen.findByRole("button", { name: /permitir análise e anúncios/i });
    await user.click(permitir);

    expect(localStorage.getItem(GA_CONSENT_STORAGE_KEY)).toBe("granted");
    expect(gtag).toHaveBeenLastCalledWith("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
    expect(screen.getByRole("button", { name: /recusar análise e anúncios/i })).toBeInTheDocument();
  });

  it("reflects a previously stored opt-out on mount", async () => {
    localStorage.setItem(GA_CONSENT_STORAGE_KEY, "denied");
    render(<CookiePreferences />);
    expect(
      await screen.findByRole("button", { name: /permitir análise e anúncios/i }),
    ).toBeInTheDocument();
  });
});
