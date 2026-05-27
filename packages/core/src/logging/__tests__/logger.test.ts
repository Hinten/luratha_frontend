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

describe("logger pretty mode (NODE_ENV=development)", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  // Use a separate logger instance whose module was loaded with
  // NODE_ENV=development, since the PRETTY gate is evaluated at import time.
  let prettyLogger: typeof import("../logger").logger;

  beforeEach(async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    prettyLogger = (await import("../logger")).logger;
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("routes logger.error to console.error", () => {
    prettyLogger.error("[t] boom");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    const [first] = errorSpy.mock.calls[0];
    expect(String(first)).toContain("[ERROR]");
    expect(String(first)).toContain("[t] boom");
  });

  it("routes logger.warn to console.warn", () => {
    prettyLogger.warn("[t] mild");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    const [first] = warnSpy.mock.calls[0];
    expect(String(first)).toContain("[WARN]");
    expect(String(first)).toContain("[t] mild");
  });

  it("routes logger.info and logger.debug to console.log", () => {
    prettyLogger.info("[t] info");
    prettyLogger.debug("[t] debug");
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(String(logSpy.mock.calls[0][0])).toContain("[INFO]");
    expect(String(logSpy.mock.calls[1][0])).toContain("[DEBUG]");
  });

  it("passes payload as a separate argument (not stringified into the message)", () => {
    const payload = { attempt: 2, reason: "transient" };
    prettyLogger.warn("[t] retry", payload);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [first, second] = warnSpy.mock.calls[0];
    expect(String(first)).toContain("[t] retry");
    expect(String(first)).not.toContain("attempt");
    expect(second).toBe(payload);
  });

  it("omits the payload arg entirely when no payload is given", () => {
    prettyLogger.info("[t] no payload");
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0]).toHaveLength(1);
  });
});
