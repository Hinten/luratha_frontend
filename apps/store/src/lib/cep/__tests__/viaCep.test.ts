import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupCep } from "@/src/lib/cep/viaCep";

describe("lookupCep", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna found com os campos e o ibge quando o ViaCEP responde", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          logradouro: "Avenida Paulista",
          bairro: "Bela Vista",
          localidade: "São Paulo",
          uf: "SP",
          ibge: "3550308",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    expect(await lookupCep("01310-100")).toEqual({
      status: "found",
      logradouro: "Avenida Paulista",
      bairro: "Bela Vista",
      localidade: "São Paulo",
      uf: "SP",
      ibge: "3550308",
    });
  });

  it("aceita CEP só com dígitos e chama o endpoint correto", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ localidade: "Rio", uf: "RJ" }), { status: 200 }),
      );
    await lookupCep("20040001");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://viacep.com.br/ws/20040001/json/",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("retorna not_found quando o ViaCEP devolve { erro: true }", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ erro: true }), { status: 200 }),
    );
    expect(await lookupCep("99999-999")).toEqual({ status: "not_found" });
  });

  it("retorna not_found para CEP com menos de 8 dígitos (sem tocar a rede)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await lookupCep("123")).toEqual({ status: "not_found" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("retorna error em HTTP != 200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));
    expect(await lookupCep("01310-100")).toEqual({ status: "error" });
  });

  it("retorna error em falha de rede (TypeError)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await lookupCep("01310-100")).toEqual({ status: "error" });
  });

  it("retorna error em timeout (AbortError)", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(abort);
    expect(await lookupCep("01310-100")).toEqual({ status: "error" });
  });

  it("retorna error quando o body não é JSON válido", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not json", { status: 200 }));
    expect(await lookupCep("01310-100")).toEqual({ status: "error" });
  });
});
