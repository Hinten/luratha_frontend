"use client";

import {
  getMercadoPagoSdk,
  type CardFormController,
  type CardFormFieldStyle,
  type MercadoPagoInstance,
} from "./loadSdk";

/**
 * Estilo aplicado dentro dos 3 iframes do MP (PAN/expiry/CVV). Valores
 * propositalmente conservadores — uma versão anterior com `fontFamily`
 * complexo + `padding` em rem fez o SDK falhar silenciosamente em
 * fetchar payment methods e installments. A doc oficial `fields.md` só
 * documenta exemplos em px e não enumera quais propriedades/unidades
 * são parseadas corretamente. Antes de expandir aqui, usar os debug
 * callbacks (`onPaymentMethodsReceived`, `onInstallmentsReceived`,
 * `onBinChange`) pra confirmar que cada adição não quebra a inicialização.
 */
const IFRAME_FIELD_STYLE: CardFormFieldStyle = {
  height: "100%",
  width: "100%",
  fontSize: "15px",
  fontFamily: "inherit",
  color: "#1f1f1f",
  placeholderColor: "#888",
};

/**
 * Wrapper sobre `mp.cardForm(...)` que devolve uma `Promise<TokenizedCardPayload>`
 * com os campos que o backend (`POST /api/checkout/payment-intent`) espera para
 * o método `credit_card`. Os campos sensíveis (PAN, CVV, expiry) ficam em
 * iframes hospedados pela MP — o PCI scope continua mínimo.
 */

export interface CardFormFieldIds {
  /** Id do <form> em que cardForm injeta os iframes. */
  formId: string;
  cardNumber: string;
  expirationDate: string;
  securityCode: string;
  cardholderName: string;
  /** Banco emissor — obrigatório pelo SDK, populado automaticamente via BIN. */
  issuer: string;
  installments: string;
  identificationType: string;
  identificationNumber: string;
  cardholderEmail: string;
}

export interface TokenizedCardPayload {
  /** Token efêmero (válido 7 dias, single-use) — vai como `cardToken`. */
  token: string;
  /** Bandeira detectada (ex.: "visa", "master") — vai como `paymentMethodId`. */
  paymentMethodId: string;
  /** Parcelas escolhidas — vai como `installments`. */
  installments: number;
  /** E-mail do pagador digitado no form (cardholderEmail). */
  cardholderEmail: string;
}

export interface MountCardFormOptions {
  /** Valor total em BRL (será formatado com 2 casas pelo MP). */
  amount: number;
  ids: CardFormFieldIds;
  /** Hook opcional para feedback de erro do SDK (ex.: BIN inválida). */
  onError?: (error: unknown) => void;
}

export interface CardFormHandle {
  /** Dispara submit do form; resolve com o payload tokenizado. */
  submit(): Promise<TokenizedCardPayload>;
  /** Decrementa o refcount; remove iframes só quando ninguém mais segura. */
  unmount(): void;
}

export class CardFormError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "CardFormError";
    this.cause = cause;
  }
}

interface PendingSubmit {
  resolve: (payload: TokenizedCardPayload) => void;
  reject: (err: unknown) => void;
}

interface ActiveMount {
  handle: CardFormHandle;
  controller: CardFormController;
}

/**
 * Refcount global: cada `mountCardForm` incrementa, cada `handle.unmount()`
 * decrementa. O `sdk.cardForm(...)` só é chamado UMA VEZ por ciclo (até o
 * refcount voltar a zero).
 *
 * Motivo: o SDK do MP guarda os "contexts" (cardNumber/expirationDate/CVV/...)
 * num registry interno e rejeita re-registrar com erro **"Context
 * 'expirationFields' already exists"**. Em Strict Mode dev (e em qualquer
 * cenário onde o `useEffect` do PaymentStep dispare 2× antes do mount async
 * resolver), múltiplas chamadas concorrentes a `sdk.cardForm` resultavam nessa
 * falha — iframes ficavam meio-inicializados (campos bloqueados, parcelas não
 * carregam). O refcount garante uma única chamada e múltiplos consumidores
 * compartilham o mesmo handle.
 */
let intentCount = 0;
let active: ActiveMount | null = null;
let pending: Promise<CardFormHandle> | null = null;

export async function mountCardForm(
  options: MountCardFormOptions,
  mp?: MercadoPagoInstance,
): Promise<CardFormHandle> {
  intentCount++;

  // Já montado: reusa o handle. As 2 IIFEs do Strict Mode dev recebem a
  // mesma referência; a 1ª chama unmount() (decrementa pra 1), a 2ª mantém
  // o form vivo.
  if (active) return active.handle;

  // Mount em andamento (entre `await getMercadoPagoSdk()` e o retorno do
  // `sdk.cardForm`): segue a mesma promise — quando resolver, o `active` já
  // está set e o caller recebe o mesmo handle.
  if (pending) return pending;

  const promise: Promise<CardFormHandle> = (async () => {
    const sdk = mp ?? (await getMercadoPagoSdk());

    let pendingSubmit: PendingSubmit | null = null;
    let controller: CardFormController | null = null;

    const finishPending = () => {
      const p = pendingSubmit;
      pendingSubmit = null;
      return p;
    };

    controller = sdk.cardForm({
      amount: options.amount.toFixed(2),
      iframe: true,
      form: {
        id: options.ids.formId,
        cardNumber: {
          id: options.ids.cardNumber,
          placeholder: "Número do cartão",
          style: IFRAME_FIELD_STYLE,
        },
        expirationDate: {
          id: options.ids.expirationDate,
          placeholder: "MM/AA",
          style: IFRAME_FIELD_STYLE,
        },
        securityCode: {
          id: options.ids.securityCode,
          placeholder: "CVV",
          style: IFRAME_FIELD_STYLE,
        },
        cardholderName: {
          id: options.ids.cardholderName,
          placeholder: "Nome impresso no cartão",
        },
        issuer: { id: options.ids.issuer, placeholder: "Banco emissor" },
        installments: { id: options.ids.installments, placeholder: "Parcelas" },
        identificationType: {
          id: options.ids.identificationType,
          placeholder: "Tipo de documento",
        },
        identificationNumber: {
          id: options.ids.identificationNumber,
          placeholder: "Número do documento",
        },
        cardholderEmail: { id: options.ids.cardholderEmail, placeholder: "E-mail" },
      },
      callbacks: {
        onFormMounted: (error) => {
          if (error) {
            console.warn("[mp.cardForm] onFormMounted error", error);
          } else {
            console.info("[mp.cardForm] mounted");
          }
        },
        onBinChange: (bin) => {
          console.info("[mp.cardForm] bin change", bin);
        },
        onPaymentMethodsReceived: (error, methods) => {
          if (error) {
            console.warn("[mp.cardForm] paymentMethods error", error);
          } else {
            console.info("[mp.cardForm] paymentMethods", methods);
          }
        },
        onInstallmentsReceived: (error, installments) => {
          if (error) {
            console.warn("[mp.cardForm] installments error", error);
          } else {
            console.info("[mp.cardForm] installments", installments);
          }
        },
        onSubmit: (event) => {
          event.preventDefault();
          const p = finishPending();
          if (!p || !controller) return;
          const data = controller.getCardFormData();
          if (!data.token || !data.paymentMethodId) {
            p.reject(
              new CardFormError(
                "Não foi possível gerar o token do cartão. Verifique os dados.",
              ),
            );
            return;
          }
          p.resolve({
            token: data.token,
            paymentMethodId: data.paymentMethodId,
            installments: Number(data.installments) || 1,
            cardholderEmail: data.cardholderEmail,
          });
        },
        onError: (error) => {
          const p = finishPending();
          options.onError?.(error);
          p?.reject(error);
        },
      },
    });

    const handle: CardFormHandle = {
      submit(): Promise<TokenizedCardPayload> {
        return new Promise<TokenizedCardPayload>((resolve, reject) => {
          if (pendingSubmit) {
            reject(new CardFormError("Submit já em andamento."));
            return;
          }
          pendingSubmit = { resolve, reject };
          const form = document.getElementById(options.ids.formId);
          if (!(form instanceof HTMLFormElement)) {
            finishPending();
            reject(
              new CardFormError(`Form "${options.ids.formId}" não encontrado no DOM.`),
            );
            return;
          }
          form.requestSubmit();
        });
      },
      unmount(): void {
        intentCount = Math.max(0, intentCount - 1);
        // Só desmonta de fato quando ninguém mais segura. Em Strict Mode dev,
        // a 1ª IIFE decrementa pra 1, a 2ª mantém — controller fica vivo.
        if (intentCount === 0 && active && active.controller === controller) {
          try {
            controller?.unmount();
          } catch (err) {
            if (!(err instanceof Error)) throw err;
            // SDK pode reclamar se já foi desmontado por outro caminho — tolerável.
          }
          active = null;
          controller = null;
        }
      },
    };

    active = { handle, controller };
    return handle;
  })();

  pending = promise;
  try {
    return await promise;
  } finally {
    if (pending === promise) pending = null;
  }
}

/** Reset interno — uso exclusivo em testes pra isolar entre cases. */
export function __resetCardFormForTesting(): void {
  if (active) {
    try {
      active.controller.unmount();
    } catch (err) {
      // Test setup teardown: SDK fake pode lançar — propagar só não-Error.
      if (!(err instanceof Error)) throw err;
    }
  }
  intentCount = 0;
  active = null;
  pending = null;
}
