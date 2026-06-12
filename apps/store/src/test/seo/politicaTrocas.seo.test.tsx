import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import PoliticaDeTrocasPage, { metadata } from "@/src/app/politica-de-trocas/page";
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

interface FaqQuestion {
  "@type": string;
  name: string;
  acceptedAnswer: { "@type": string; text: string };
}

describe("politica-de-trocas page (AEO)", () => {
  it("exports complete, canonical metadata", () => {
    expectSeoMetadata(metadata, { canonicalPath: "/politica-de-trocas" });
  });

  it("renders a FAQPage derived from every policy section", () => {
    const { container } = render(<PoliticaDeTrocasPage />);
    const faq = findSchemaByType(getJsonLdScripts(container), "FAQPage");
    assertSchemaOrgBase(faq);

    const questions = faq.mainEntity as FaqQuestion[];
    expect(questions).toHaveLength(6);
    for (const question of questions) {
      expect(question["@type"]).toBe("Question");
      expect(question.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });
});
