import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// O MetaPixel renderiza um <Suspense> com o tracker de rota, que usa
// next/navigation — mockado para não exigir contexto de router.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import MetaPixel from "@/src/components/analytics/MetaPixel";

describe("MetaPixel", () => {
  it("renders null when no pixelId is configured", () => {
    const { container } = render(<MetaPixel pixelId="" />);
    expect(container.innerHTML).toBe("");
  });

  it("injects the bootstrap with init, PageView and the shared opt-out guard", () => {
    const { container } = render(<MetaPixel pixelId="123456789012345" />);
    expect(container.querySelector("#meta-pixel-bootstrap")).not.toBeNull();

    const html = container.innerHTML;
    expect(html).toContain("fbq('init', \"123456789012345\")");
    expect(html).toContain("fbq('track', 'PageView')");
    expect(html).toContain("fbq('consent','revoke')");
    // Opt-out compartilhado com o GA4 (mesma chave de localStorage).
    expect(html).toContain("luratha_consent_v1");
    expect(html).toContain("connect.facebook.net/en_US/fbevents.js");
  });

  it("renders a noscript fallback element (no-JS pixel)", () => {
    // jsdom não serializa filhos de <noscript>, então só verificamos a presença
    // do elemento — o <img> de fallback é exercitado no browser real / E2E.
    const { container } = render(<MetaPixel pixelId="123456789012345" />);
    expect(container.querySelector("noscript")).not.toBeNull();
  });
});
