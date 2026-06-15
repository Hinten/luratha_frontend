import { z } from "zod";

/**
 * Email "strict": além do formato checado pelo `z.email()`, garante que o
 * valor tem exatamente um `@`.
 *
 * O regex default do Zod 4 já rejeita múltiplos `@`, mas a garantia precisa
 * ser explícita e estável: o adapter MercadoPago (`withSandboxEmail`) deriva
 * o local-part via `email.split("@")[0]` e um input patológico como
 * `"a@b@c.com"` viraria `"a@testuser.com"` — sintaticamente válido, mas
 * capaz de colidir com o test user do vendedor (issue #160).
 */
export const strictEmail = (message = "E-mail inválido.") =>
  z.email(message).refine((email) => email.split("@").length === 2, { message });
