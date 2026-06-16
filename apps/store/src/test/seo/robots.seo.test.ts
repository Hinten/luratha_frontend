import { describe, it, expect } from "vitest";
import robots from "@/src/app/robots";
import { SITE_URL } from "./seoAssertions";

describe("robots (SEO)", () => {
  it("allows crawling the public site root", () => {
    const { rules } = robots();
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
  });

  it("blocks private and transactional paths from the crawl", () => {
    const { rules } = robots();
    const disallow = Array.isArray(rules)
      ? rules.flatMap((rule) => rule.disallow ?? [])
      : (rules.disallow ?? []);
    const list = Array.isArray(disallow) ? disallow : [disallow];

    expect(list).toEqual(
      expect.arrayContaining(["/conta/", "/carrinho/", "/checkout", "/api/", "/busca?*"]),
    );
  });

  it("points crawlers at the absolute sitemap URL", () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
