import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import JsonLd from "@/src/components/JsonLd";
import type { Organization, WithContext } from "schema-dts";

describe("JsonLd", () => {
  const testData: WithContext<Organization> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Luratha",
    url: "https://www.luratha.com.br",
  };

  it("renders a script tag with type application/ld+json", () => {
    const { container } = render(<JsonLd data={testData} />);
    const script = container.querySelector("script");
    expect(script).not.toBeNull();
    expect(script?.getAttribute("type")).toBe("application/ld+json");
  });

  it("renders the JSON-LD data as valid JSON inside the script tag", () => {
    const { container } = render(<JsonLd data={testData} />);
    const script = container.querySelector("script");
    const parsed = JSON.parse(script?.innerHTML ?? "");
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("Organization");
    expect(parsed.name).toBe("Luratha");
  });

  it("serializes complex nested schema objects correctly", () => {
    const complexData: WithContext<Organization> = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Luratha",
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+55-12-98278-9225",
        contactType: "customer service",
      },
    };
    const { container } = render(<JsonLd data={complexData} />);
    const script = container.querySelector("script");
    const parsed = JSON.parse(script?.innerHTML ?? "");
    expect(parsed.contactPoint["@type"]).toBe("ContactPoint");
    expect(parsed.contactPoint.telephone).toBe("+55-12-98278-9225");
  });
});
