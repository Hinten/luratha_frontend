import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import ReferenciaDeMedidasPage, { metadata } from "@/src/app/referencia-de-medidas/page";
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

describe("referencia-de-medidas page (AEO)", () => {
  it("exports complete, canonical metadata", () => {
    expectSeoMetadata(metadata, { canonicalPath: "/referencia-de-medidas" });
  });

  it("renders a FAQPage with answered questions", () => {
    const { container } = render(<ReferenciaDeMedidasPage />);
    const faq = findSchemaByType(getJsonLdScripts(container), "FAQPage");
    assertSchemaOrgBase(faq);

    const questions = faq.mainEntity as FaqQuestion[];
    expect(questions).toHaveLength(4);
    for (const question of questions) {
      expect(question["@type"]).toBe("Question");
      expect(question.name.length).toBeGreaterThan(0);
      expect(question.acceptedAnswer["@type"]).toBe("Answer");
      expect(question.acceptedAnswer.text.length).toBeGreaterThan(0);
    }
  });
});
