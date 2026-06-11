import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import SobrePage, { metadata } from "@/src/app/sobre/page";
import {
  getJsonLdScripts,
  findSchemaByType,
  assertSchemaOrgBase,
  expectSeoMetadata,
} from "./seoAssertions";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("sobre page (AEO / SEO)", () => {
  it("exports complete, canonical metadata", () => {
    expectSeoMetadata(metadata, { canonicalPath: "/sobre" });
  });

  it("renders AboutPage and Organization schemas", () => {
    const { container } = render(<SobrePage />);
    const scripts = getJsonLdScripts(container);

    assertSchemaOrgBase(findSchemaByType(scripts, "AboutPage"));

    const organization = findSchemaByType(scripts, "Organization");
    assertSchemaOrgBase(organization);
    expect(organization.name).toBe("Luratha");
    expect(Array.isArray(organization.sameAs)).toBe(true);
    for (const profile of organization.sameAs as string[]) {
      expect(profile).toMatch(/^https:\/\//);
    }
    expect((organization.foundingLocation as { name: string }).name).toBe("Brasil");
  });
});
