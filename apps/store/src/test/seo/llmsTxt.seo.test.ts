import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Resolve relative to this file so the test passes regardless of cwd.
const llmsTxtPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public/llms.txt",
);
const llmsTxt = readFileSync(llmsTxtPath, "utf8");

describe("llms.txt (GEO / AEO)", () => {
  it("opens with the Luratha brand heading and mission summary", () => {
    expect(llmsTxt.startsWith("# Luratha")).toBe(true);
    expect(llmsTxt).toContain("slow fashion");
    expect(llmsTxt).toContain("**Missão:**");
  });

  it("lists the key shopping routes for answer engines", () => {
    expect(llmsTxt).toContain("(/todas-as-pecas)");
    expect(llmsTxt).toContain("(/sale)");
    expect(llmsTxt).toContain("(/busca)");
    expect(llmsTxt).toContain("(/produto/[slug])");
  });

  it("links categories via the canonical /categoria/ route, never /colecao", () => {
    expect(llmsTxt).toContain("(/categoria/vestidos)");
    expect(llmsTxt).toContain("(/categoria/acessorios)");
    expect(llmsTxt).not.toContain("/colecao");
  });

  it("exposes the institutional pages and contact channels", () => {
    expect(llmsTxt).toContain("(/sobre)");
    expect(llmsTxt).toContain("(/contato)");
    expect(llmsTxt).toContain("(/politica-de-trocas)");
    expect(llmsTxt).toContain("(/referencia-de-medidas)");
    expect(llmsTxt).toContain("wa.me/");
    expect(llmsTxt).toContain("instagram.com/_luratha");
  });
});
