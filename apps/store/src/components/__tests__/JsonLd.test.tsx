import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import JsonLd, { type JsonLdData } from "@/src/components/JsonLd";

describe("JsonLd", () => {
  it("escapes `<` so a configurable value cannot break out of the <script> tag", () => {
    const data: JsonLdData = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      // Simulates a malicious value typed into the admin (e.g. company.legalName).
      name: "</script><script>alert(1)</script>",
    };

    const { container } = render(<JsonLd data={data} />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    const html = script!.innerHTML;
    // The literal closing-tag sequence must not survive in the rendered markup.
    expect(html).not.toContain("</script>");
    // `<` was escaped to its JSON unicode form.
    expect(html).toContain("\\u003c");
    // …yet the structured data is semantically preserved (parser reverses it).
    expect((JSON.parse(html) as { name: string }).name).toBe(
      "</script><script>alert(1)</script>",
    );
  });

  it("renders valid, unchanged JSON-LD for ordinary data", () => {
    const data: JsonLdData = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [],
    };

    const { container } = render(<JsonLd data={data} />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(JSON.parse(script!.innerHTML)).toEqual(data);
  });
});
