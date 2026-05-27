import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../logger";

describe("logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let lines: string[];

  beforeEach(() => {
    lines = [];
    logSpy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  function lastEntry(): Record<string, unknown> {
    const last = lines[lines.length - 1];
    return JSON.parse(last);
  }

  it("emits DEBUG severity for logger.debug", () => {
    logger.debug("[t] message");
    expect(lastEntry()).toEqual({ severity: "DEBUG", message: "[t] message" });
  });

  it("emits INFO severity for logger.info", () => {
    logger.info("[t] message");
    expect(lastEntry()).toEqual({ severity: "INFO", message: "[t] message" });
  });

  it("emits WARNING severity for logger.warn (note: API name is `warn`)", () => {
    logger.warn("[t] message");
    expect(lastEntry()).toEqual({ severity: "WARNING", message: "[t] message" });
  });

  it("emits ERROR severity for logger.error", () => {
    logger.error("[t] message");
    expect(lastEntry()).toEqual({ severity: "ERROR", message: "[t] message" });
  });

  it("omits the `payload` field when no payload is given", () => {
    logger.info("[t] no payload");
    const entry = lastEntry();
    expect(entry).not.toHaveProperty("payload");
  });

  it("includes the payload as a structured field, not stringified", () => {
    logger.warn("[t] retry", { attempt: 2, reason: "transient" });
    expect(lastEntry()).toEqual({
      severity: "WARNING",
      message: "[t] retry",
      payload: { attempt: 2, reason: "transient" },
    });
  });

  it("flattens Error instances inside the payload (omits stack)", () => {
    const err = new Error("boom");
    logger.error("[t] op failed", { err });
    const entry = lastEntry();
    expect(entry.payload).toEqual({
      err: { name: "Error", message: "boom" },
    });
    expect(JSON.stringify(entry)).not.toContain("stack");
  });

  it("includes custom enumerable props on Error subclasses", () => {
    class ProviderError extends Error {
      code = "provider_unavailable";
      status = 502;
    }
    logger.error("[t] mp failed", { err: new ProviderError("nope") });
    expect(lastEntry().payload).toEqual({
      err: {
        name: "Error",
        message: "nope",
        code: "provider_unavailable",
        status: 502,
      },
    });
  });

  it("falls back to a String-coerced payload when JSON.stringify fails (cycle)", () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    logger.warn("[t] cyclic", cyclic);
    const entry = lastEntry();
    expect(entry.severity).toBe("WARNING");
    expect(entry.message).toBe("[t] cyclic");
    expect(typeof entry.payload).toBe("string");
  });

  it("invokes console.log exactly once per call (single-arg JSON string)", () => {
    logger.info("[t] a");
    logger.warn("[t] b");
    expect(lines).toHaveLength(2);
    // Each entry parses as a single JSON object.
    expect(() => JSON.parse(lines[0])).not.toThrow();
    expect(() => JSON.parse(lines[1])).not.toThrow();
  });
});
