import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MP_BODY_TIMEOUT_MS, MP_HTTP_TIMEOUT_MS } from "../client";
import { getOrder } from "../index";
import { PaymentProviderError } from "../../types";

/**
 * Cobre o timeout por fase do `mpFetch` (issue #162) através da superfície
 * pública `getOrder` — `mpFetch` é privado. Mockamos `fetch` e usamos fake
 * timers para disparar o `AbortController` em cada fase deterministicamente.
 *
 * O mock fia o evento `abort` do signal à rejeição da promise pendente
 * (`fetch` ou `response.text()`), espelhando o contrato do undici: abortar o
 * signal após o `fetch()` resolver cancela o body stream em andamento.
 */

const ORDER_ID = "ORD01TEST";

function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

describe("mpFetch — timeout por fase (via getOrder)", () => {
  beforeEach(() => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-token";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retorna o summary quando headers e body chegam dentro do budget", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () =>
        JSON.stringify({
          id: ORDER_ID,
          status: "action_required",
          external_reference: "order-123",
        }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const summary = await getOrder(ORDER_ID);

    expect(summary).toMatchObject({
      paymentId: ORDER_ID,
      status: "pending",
      orderId: "order-123",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("aborta na fase de headers quando o fetch não resolve no budget", async () => {
    // `fetch` só rejeita quando o signal aborta — simula o MP que não responde.
    const fetchMock = vi.fn(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener("abort", () => reject(abortError()));
        }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const promise = getOrder(ORDER_ID);
    const assertion = expect(promise).rejects.toMatchObject({
      code: "provider_unavailable",
    });

    await vi.advanceTimersByTimeAsync(MP_HTTP_TIMEOUT_MS + 1);

    await assertion;
    await expect(promise).rejects.toBeInstanceOf(PaymentProviderError);
  });

  it("aborta na fase de body read quando o body stalla (fecha o gap da #162)", async () => {
    // Headers chegam na hora; `response.text()` fica pendurado até o signal
    // abortar. No código antigo o timer era limpo após o fetch resolver, então
    // o abort nunca disparava no body e este `await` penduraria para sempre.
    const fetchMock = vi.fn(
      async (_url: string, opts: { signal: AbortSignal }) => ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () =>
          new Promise<string>((_resolve, reject) => {
            opts.signal.addEventListener("abort", () => reject(abortError()));
          }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const promise = getOrder(ORDER_ID);
    const assertion = expect(promise).rejects.toMatchObject({
      code: "provider_unavailable",
    });

    // Deixa o fetch resolver e o timer de body ser re-armado, sem chegar nos
    // MP_HTTP_TIMEOUT_MS da fase de headers.
    await vi.advanceTimersByTimeAsync(0);
    // Só o budget de body, re-armado, deve disparar o abort.
    await vi.advanceTimersByTimeAsync(MP_BODY_TIMEOUT_MS + 1);

    await assertion;
  });
});
