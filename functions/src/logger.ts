/**
 * Structured logger — local copy of `@luratha/core/logging/logger`.
 *
 * `functions/` is a separate npm project outside the pnpm workspace, so it
 * cannot import shared packages. Keep this file in sync with the storefront
 * version: same JSON shape (`{severity, message, payload?}`), same Error
 * extraction, same fallback for unserializable payloads.
 *
 * Cloud Logging parses JSON written to stdout and uses the embedded
 * `severity` to classify the entry — letting operators filter
 * `severity=WARNING` vs `severity=ERROR` in the Logs Explorer.
 */

type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

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

function errorReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    const err = value as Error & Record<string, unknown>;
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };
    for (const k of Object.keys(err)) {
      if (k === "stack") continue;
      out[k] = err[k];
    }
    return out;
  }
  return value;
}

function emitPretty(severity: Severity, message: string, payload?: unknown): void {
  const isTty = Boolean(process.stdout?.isTTY);
  const prefix = isTty ? `${ANSI[severity]}${TAG[severity]}\x1b[0m` : TAG[severity];
  const sink =
    severity === "ERROR" ? console.error : severity === "WARNING" ? console.warn : console.log;
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
    line = JSON.stringify({ severity, message, payload: String(payload) });
  }
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
