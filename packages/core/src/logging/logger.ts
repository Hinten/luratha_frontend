import { errorReplacer } from "./serializeLogPayload";

/**
 * Structured logger that emits one JSON line per call with a `severity`
 * field. Firebase App Hosting runs on Cloud Run, and Cloud Logging
 * automatically parses JSON written to stdout and uses the embedded
 * `severity` to classify the entry. This lets operators filter the Logs
 * Explorer by `severity=WARNING` vs `severity=ERROR` independently of the
 * underlying stream (which would otherwise collapse `console.warn` and
 * `console.error` into the same ERROR bucket via stderr mapping).
 *
 * Severities exposed map to the Cloud Logging vocabulary:
 *   debug → DEBUG, info → INFO, warn → WARNING, error → ERROR.
 *
 * The payload (second arg, optional) is preserved as a `payload` JSON
 * field — queryable in Logs Explorer via `jsonPayload.payload.<path>`.
 * `Error` instances inside the payload are flattened to
 * `{ name, message, ...customProps }` (stack omitted).
 *
 * @example
 * logger.info("[scope] starting…");
 * logger.warn("[scope] retry triggered", { attempt: 2 });
 * logger.error("[scope] op failed", { context, err });
 */

type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

// Gate evaluated once at module load. Next.js inlines `process.env.NODE_ENV`
// in both server and client bundles, so this works in either context. The
// pretty branch only kicks in during `pnpm dev`; production and test (vitest
// default) take the JSON path unchanged.
const PRETTY = process.env.NODE_ENV === "development";

const TAG: Record<Severity, string> = {
  DEBUG: "[DEBUG]",
  INFO: "[INFO]",
  WARNING: "[WARN]",
  ERROR: "[ERROR]",
};

const ANSI: Record<Severity, string> = {
  DEBUG: "\x1b[90m",
  INFO: "\x1b[36m",
  WARNING: "\x1b[33m",
  ERROR: "\x1b[31m",
};

function emitPretty(severity: Severity, message: string, payload?: unknown): void {
  const isTty =
    typeof process !== "undefined" && Boolean(process.stdout?.isTTY);
  const prefix = isTty ? `${ANSI[severity]}${TAG[severity]}\x1b[0m` : TAG[severity];
  // Route by severity so terminals/DevTools render with native severity
  // icons and colors. Safe in dev — production never takes this branch, so
  // the Cloud Run stderr → ERROR mapping is not affected.
  const sink =
    severity === "ERROR"
      ? console.error
      : severity === "WARNING"
        ? console.warn
        : console.log;
  if (payload !== undefined) {
    sink(`${prefix} ${message}`, payload);
  } else {
    sink(`${prefix} ${message}`);
  }
}

function emit(severity: Severity, message: string, payload?: unknown): void {
  if (PRETTY) {
    emitPretty(severity, message, payload);
    return;
  }
  const entry: Record<string, unknown> = { severity, message };
  if (payload !== undefined) {
    entry.payload = payload;
  }
  let line: string;
  try {
    line = JSON.stringify(entry, errorReplacer);
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
    // Cycle or BigInt in payload — fall back to a minimal entry so the
    // severity still reaches Cloud Logging; the unserializable payload is
    // coerced via String() to preserve at least some signal.
    line = JSON.stringify({
      severity,
      message,
      payload: String(payload),
    });
  }
  // `console.log` writes to stdout in Node (so Cloud Logging picks up the
  // structured `severity`) and to DevTools in the browser. Always a single
  // argument so Cloud Logging sees one entry per call.
  console.log(line);
}

export const logger = {
  debug(message: string, payload?: unknown): void {
    emit("DEBUG", message, payload);
  },
  info(message: string, payload?: unknown): void {
    emit("INFO", message, payload);
  },
  warn(message: string, payload?: unknown): void {
    emit("WARNING", message, payload);
  },
  error(message: string, payload?: unknown): void {
    emit("ERROR", message, payload);
  },
};
