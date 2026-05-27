/**
 * Serializes a log payload into a compact single-line JSON string.
 *
 * Firebase App Hosting forwards stdout/stderr to Cloud Logging, which splits
 * `console.error("msg", obj)` into one entry per line of `util.inspect`. That
 * makes errors uncopyable. Embedding the payload in the message via this
 * helper keeps the whole record on a single line.
 *
 * Behavior:
 * - `Error` instances → `{ name, message, ...customEnumerableProps }`.
 *   `stack` is intentionally omitted (Cloud Logging keeps stacks separately).
 * - Cycles or unserializable values (e.g. `BigInt`) → falls back to
 *   `String(payload)` instead of throwing.
 */
export function serializeLogPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, errorReplacer);
  } catch (err) {
    if (err instanceof TypeError) {
      return String(payload);
    }
    throw err;
  }
}

/**
 * `JSON.stringify` replacer used by both `serializeLogPayload` and the
 * structured logger. Extracts `name`, `message`, and custom enumerable
 * own-properties from `Error` instances; `stack` is intentionally omitted.
 */
export function errorReplacer(_key: string, value: unknown): unknown {
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
