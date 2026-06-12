import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ContatoPage, { metadata } from "@/src/app/contato/page";
import {
  getJsonLdScripts,
  findSchemaByType,
  assertSchemaOrgBase,
  expectSeoMetadata,
} from "./seoAssertions";

describe("contato page (AEO / SEO)", () => {
  it("exports complete, canonical metadata", () => {
    expectSeoMetadata(metadata, { canonicalPath: "/contato" });
  });

  it("renders ContactPage and LocalBusiness schemas with a contact point", () => {
    const { container } = render(<ContatoPage />);
    const scripts = getJsonLdScripts(container);

    assertSchemaOrgBase(findSchemaByType(scripts, "ContactPage"));

    const localBusiness = findSchemaByType(scripts, "LocalBusiness");
    assertSchemaOrgBase(localBusiness);
    expect(localBusiness.telephone).toBeTruthy();
    const contactPoints = localBusiness.contactPoint as Array<{ "@type": string }>;
    expect(contactPoints.length).toBeGreaterThan(0);
    expect(contactPoints[0]["@type"]).toBe("ContactPoint");
  });
});
