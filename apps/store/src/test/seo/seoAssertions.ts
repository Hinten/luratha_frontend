/**
 * Shared assertion helpers for the SEO / AEO / GEO suite.
 *
 * These read Next.js `Metadata` objects and JSON-LD `<script>` tags rendered
 * into the DOM, normalizing the many union shapes Next allows (string vs
 * `TemplateString`, `string | URL`, single vs array images) into plain values
 * the tests can assert against.
 *
 * No `try/catch` here on purpose: a malformed JSON-LD payload should throw the
 * raw `SyntaxError` from `JSON.parse`, surfacing as a clear test failure rather
 * than a swallowed fallback.
 */
import { expect } from "vitest";
import type { Metadata } from "next";

export const SITE_URL = "https://www.luratha.com.br";

export type JsonLdRecord = Record<string, unknown>;

/**
 * Collects every `application/ld+json` block in `container`, parses it, and
 * flattens any `@graph`-style arrays so callers get a flat list of schema
 * objects to search by `@type`.
 */
export function getJsonLdScripts(container: HTMLElement): JsonLdRecord[] {
  const nodes = container.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  const out: JsonLdRecord[] = [];
  for (const node of Array.from(nodes)) {
    const parsed = JSON.parse(node.textContent ?? "") as JsonLdRecord | JsonLdRecord[];
    if (Array.isArray(parsed)) {
      out.push(...parsed);
    } else {
      out.push(parsed);
    }
  }
  return out;
}

export function findSchemaByType(scripts: JsonLdRecord[], type: string): JsonLdRecord | undefined {
  return scripts.find((schema) => schema["@type"] === type);
}

/** Asserts the object exists and carries a valid schema.org `@context`/`@type`. */
export function assertSchemaOrgBase(
  schema: JsonLdRecord | undefined,
): asserts schema is JsonLdRecord {
  expect(schema, "expected a JSON-LD schema object").toBeTruthy();
  if (!schema) return;
  expect(schema["@context"]).toBe("https://schema.org");
  expect(typeof schema["@type"], "@type must be a string").toBe("string");
  expect((schema["@type"] as string).length).toBeGreaterThan(0);
}

function readTemplateOrString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as { absolute?: unknown; default?: unknown };
    if (typeof record.absolute === "string") return record.absolute;
    if (typeof record.default === "string") return record.default;
  }
  return "";
}

export function readTitleText(metadata: Metadata): string {
  return readTemplateOrString(metadata.title);
}

function urlToString(value: string | URL): string {
  return value instanceof URL ? value.toString() : value;
}

export function readCanonical(metadata: Metadata): string | undefined {
  const canonical = metadata.alternates?.canonical;
  if (canonical == null) return undefined;
  if (typeof canonical === "string") return canonical;
  if (canonical instanceof URL) return canonical.toString();
  return urlToString((canonical as { url: string | URL }).url);
}

export interface OgImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export function readOgImages(metadata: Metadata): OgImage[] {
  const images = metadata.openGraph?.images;
  if (!images) return [];
  const list = Array.isArray(images) ? images : [images];
  return list.map((image) => {
    if (typeof image === "string") return { url: image };
    if (image instanceof URL) return { url: image.toString() };
    const record = image as { url: string | URL; alt?: string; width?: number; height?: number };
    return {
      url: urlToString(record.url),
      alt: record.alt,
      width: record.width,
      height: record.height,
    };
  });
}

export interface SeoMetadataExpectation {
  /** Path appended to SITE_URL for the expected canonical, e.g. "/sobre" or "". */
  canonicalPath?: string;
  titleIncludes?: string;
  maxTitleLength?: number;
  maxDescriptionLength?: number;
  /** When true, asserts openGraph + at least one OG image. Default true. */
  expectOpenGraph?: boolean;
}

/**
 * Asserts the metadata covers the SEO essentials: a non-empty, length-bounded
 * title and description, the expected absolute canonical, and a complete
 * Open Graph block with at least one image.
 */
export function expectSeoMetadata(metadata: Metadata, options: SeoMetadataExpectation = {}): void {
  const { maxTitleLength = 60, maxDescriptionLength = 160, expectOpenGraph = true } = options;

  const title = readTitleText(metadata);
  expect(title.length, "title must be non-empty").toBeGreaterThan(0);
  expect(title.length, `title should be <= ${maxTitleLength} chars`).toBeLessThanOrEqual(
    maxTitleLength,
  );
  if (options.titleIncludes) expect(title).toContain(options.titleIncludes);

  const description = typeof metadata.description === "string" ? metadata.description : "";
  expect(description.length, "description must be non-empty").toBeGreaterThan(0);
  expect(
    description.length,
    `description should be <= ${maxDescriptionLength} chars`,
  ).toBeLessThanOrEqual(maxDescriptionLength);

  if (options.canonicalPath !== undefined) {
    expect(readCanonical(metadata)).toBe(`${SITE_URL}${options.canonicalPath}`);
  }

  if (expectOpenGraph) {
    const openGraph = metadata.openGraph;
    expect(openGraph, "openGraph must be defined").toBeTruthy();
    if (openGraph) {
      expect(readTemplateOrString(openGraph.title).length, "OG title non-empty").toBeGreaterThan(0);
      const ogDescription = typeof openGraph.description === "string" ? openGraph.description : "";
      expect(ogDescription.length, "OG description non-empty").toBeGreaterThan(0);
      expect(openGraph.url, "OG url must be defined").toBeTruthy();
      const images = readOgImages(metadata);
      expect(images.length, "OG must have at least one image").toBeGreaterThan(0);
      expect(images[0].url.length, "OG image url non-empty").toBeGreaterThan(0);
    }
  }
}
