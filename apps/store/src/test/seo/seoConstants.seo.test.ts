import { describe, it, expect } from "vitest";
import { SITE_URL, LURATHA_SCHEMA, DEFAULT_OG_IMAGE } from "@/src/lib/seoConstants";

describe("seoConstants (SEO)", () => {
  it("exposes an https SITE_URL with no trailing slash", () => {
    expect(SITE_URL).toMatch(/^https:\/\//);
    expect(SITE_URL.endsWith("/")).toBe(false);
  });

  it("describes the brand for Organization/WebSite schema", () => {
    expect(LURATHA_SCHEMA.name).toBe("Luratha");
    expect(LURATHA_SCHEMA.url).toBe(SITE_URL);
    expect(LURATHA_SCHEMA.logo.startsWith(SITE_URL)).toBe(true);
    expect(LURATHA_SCHEMA.sameAs.length).toBeGreaterThan(0);
    for (const profile of LURATHA_SCHEMA.sameAs) {
      expect(profile).toMatch(/^https:\/\//);
    }
  });

  it("provides a 1200x630 default Open Graph image with absolute url and alt", () => {
    expect(DEFAULT_OG_IMAGE.url.startsWith(SITE_URL)).toBe(true);
    expect(DEFAULT_OG_IMAGE.width).toBe(1200);
    expect(DEFAULT_OG_IMAGE.height).toBe(630);
    expect(DEFAULT_OG_IMAGE.alt.length).toBeGreaterThan(0);
  });
});
