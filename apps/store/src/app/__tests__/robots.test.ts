import { describe, it, expect } from "vitest";
import robots from "@/src/app/robots";

describe("robots", () => {
  it("bloqueia rotas privadas/transacionais do crawl", () => {
    const { rules } = robots();
    // `rules` é um objeto único (não array) neste projeto.
    const disallow = Array.isArray(rules) ? rules.flatMap((r) => r.disallow ?? []) : rules.disallow;
    const list = Array.isArray(disallow) ? disallow : disallow ? [disallow] : [];

    // /checkout precisa estar SEM barra final para cobrir a landing `/checkout`
    // e as subrotas (`/checkout/sucesso/...`) por prefixo.
    expect(list).toContain("/checkout");
    expect(list).toEqual(expect.arrayContaining(["/conta/", "/carrinho/", "/api/"]));
  });

  it("expõe o sitemap", () => {
    const result = robots();
    expect(result.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
