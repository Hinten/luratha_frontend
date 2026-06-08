import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import Breadcrumb from "@/src/components/Breadcrumb";
import { getJsonLdScripts, findSchemaByType, assertSchemaOrgBase } from "./seoAssertions";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("Breadcrumb BreadcrumbList schema (SEO)", () => {
  it("emits sequential positions and a URL only for linked crumbs", () => {
    const { container } = render(
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Vestidos", href: "/categoria/vestidos" },
          { label: "Vestido Bordado Floral" },
        ]}
      />,
    );

    const breadcrumb = findSchemaByType(getJsonLdScripts(container), "BreadcrumbList");
    assertSchemaOrgBase(breadcrumb);

    const items = breadcrumb.itemListElement as Array<{
      position: number;
      name: string;
      item?: string;
    }>;
    expect(items.map((entry) => entry.position)).toEqual([1, 2, 3]);
    expect(items[0].item).toBe("/");
    expect(items[1].item).toBe("/categoria/vestidos");
    // The current page (no href) must not carry an `item` URL.
    expect(items[2].item).toBeUndefined();
    expect(items[2].name).toBe("Vestido Bordado Floral");
  });
});
