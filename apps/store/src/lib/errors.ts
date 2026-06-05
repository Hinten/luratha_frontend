/**
 * Shared error classes for client-side narrowing.
 *
 * See CLAUDE.md → "No generic catches" — every `catch` must narrow on a
 * specific subclass before swallowing. `instanceof Error` does not count, so
 * any caller that needs to react to a thrown error from our own code (HTTP
 * responses, auth flow) should throw one of the classes defined here.
 */
import type { z } from "zod";

/**
 * Thrown by client-side fetch wrappers when the server responds with a
 * non-OK status. The form pages narrow on this to display the server's
 * message to the user; anything else (network failure, parse error,
 * unexpected runtime bug) is allowed to propagate to the ErrorBoundary so
 * it surfaces in the console instead of becoming an opaque "fallback"
 * string.
 */
export class ApiResponseError extends Error {
  readonly status: number;
  /**
   * Quando o backend responde 400 com Zod issues (`{ message, errors }`),
   * a lista vem aqui para que forms possam mapear cada issue ao seu campo
   * via `setError(path, { message })`. Vazio para outros tipos de erro.
   */
  readonly issues: readonly z.core.$ZodIssue[];
  /**
   * Código de erro estruturado opcional vindo do backend (ex.: `config_missing`,
   * `provider_unavailable`, `invalid_input`). Usado pelo mapper de mensagens
   * amigáveis do checkout para discriminar erros que compartilham o mesmo
   * status HTTP mas têm copy diferente pro cliente.
   */
  readonly code: string | undefined;

  constructor(
    message: string,
    status: number,
    issues: readonly z.core.$ZodIssue[] = [],
    code?: string,
  ) {
    super(message);
    this.name = "ApiResponseError";
    this.status = status;
    this.issues = issues;
    this.code = code;
  }
}

/**
 * Thrown by `AuthContext` when authentication fails for a known reason
 * (bad credentials, weak password, email already in use, etc.). Login,
 * register, and password-reset forms narrow on this to render the message
 * to the user.
 *
 * Unknown errors from Firebase Auth or network failures are NOT wrapped —
 * they propagate so we can see the real stack in the console.
 */
export class AuthClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthClientError";
  }
}

/**
 * Reads `{ message?: string }` out of a fetch JSON payload and throws
 * `ApiResponseError` when the response is not OK. Helper kept here so
 * form pages share the same narrowing point.
 */
export async function throwIfNotOk(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) return;
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (err) {
    if (!(err instanceof SyntaxError)) {
      throw err;
    }
    // Body wasn't JSON — fall through to the fallback message.
  }
  const message =
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof (payload as { message: unknown }).message === "string"
      ? (payload as { message: string }).message
      : fallbackMessage;
  const issues =
    payload &&
    typeof payload === "object" &&
    "errors" in payload &&
    Array.isArray((payload as { errors: unknown }).errors)
      ? (payload as { errors: z.core.$ZodIssue[] }).errors
      : [];
  const code =
    payload &&
    typeof payload === "object" &&
    "code" in payload &&
    typeof (payload as { code: unknown }).code === "string"
      ? (payload as { code: string }).code
      : undefined;
  throw new ApiResponseError(message, response.status, issues, code);
}
