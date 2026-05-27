import { describe, it, expect } from "vitest";
import { serializeLogPayload } from "../serializeLogPayload";

describe("serializeLogPayload", () => {
  it("serializes a plain object as compact JSON", () => {
    expect(serializeLogPayload({ foo: "bar", n: 1 })).toBe(
      '{"foo":"bar","n":1}',
    );
  });

  it("extracts name and message from a plain Error, omitting stack", () => {
    const result = serializeLogPayload(new Error("boom"));
    expect(JSON.parse(result)).toEqual({ name: "Error", message: "boom" });
    expect(result).not.toContain("stack");
  });

  it("includes custom enumerable props from Error subclasses", () => {
    class ProviderError extends Error {
      code = "provider_unavailable";
      status = 502;
    }
    const result = serializeLogPayload(new ProviderError("nope"));
    expect(JSON.parse(result)).toEqual({
      name: "Error",
      message: "nope",
      code: "provider_unavailable",
      status: 502,
    });
  });

  it("falls back to String(payload) when JSON.stringify throws (cycles)", () => {
    const cyclic: Record<string, unknown> = { foo: "bar" };
    cyclic.self = cyclic;
    const result = serializeLogPayload(cyclic);
    expect(result).toBe(String(cyclic));
  });

  it("falls back to String(payload) for BigInt values", () => {
    const result = serializeLogPayload({ big: 1n });
    expect(result).toBe(String({ big: 1n }));
  });

  it("serializes nested { context, err } payloads as a single JSON object", () => {
    const err = new Error("upstream failed");
    const result = serializeLogPayload({ context: { id: "abc" }, err });
    expect(JSON.parse(result)).toEqual({
      context: { id: "abc" },
      err: { name: "Error", message: "upstream failed" },
    });
  });
});
