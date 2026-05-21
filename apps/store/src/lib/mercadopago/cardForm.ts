"use client";

import {
  getMercadoPagoSdk,
  type CardFormController,
  type MercadoPagoInstance,
} from "./loadSdk";

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
  /** Remove iframes injetados pelo MP. */
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

/**
 * Controller "ativo" no módulo. O SDK do MP rejeita um segundo `cardForm({...})`
 * enquanto o anterior ainda está vivo ("Context 'expirationFields' already
 * exists"). Em Next.js dev (Strict Mode), o `useEffect` do PaymentStep dispara
 * 2× e essa proteção desmonta o antigo antes do novo subir, eliminando a
 * corrida sem precisar de timeouts ou retries.
 */
let activeController: CardFormController | null = null;

export async function mountCardForm(
  options: MountCardFormOptions,
  mp?: MercadoPagoInstance,
): Promise<CardFormHandle> {
  const sdk = mp ?? (await getMercadoPagoSdk());

  // Strict Mode dev pode chamar mountCardForm 2× antes do cleanup do primeiro
  // resolver. Desmonta proativamente o anterior pra evitar "Context already exists".
  if (activeController) {
    try {
      activeController.unmount();
    } catch (err) {
      if (!(err instanceof Error)) throw err;
      // SDK pode reclamar se já foi desmontado por outro caminho — tolerável.
    }
    activeController = null;
  }

  let pending: PendingSubmit | null = null;
  let controller: CardFormController | null = null;

  const finishPending = () => {
    const p = pending;
    pending = null;
    return p;
  };

  controller = sdk.cardForm({
    amount: options.amount.toFixed(2),
    iframe: true,
    form: {
      id: options.ids.formId,
      cardNumber: { id: options.ids.cardNumber, placeholder: "Número do cartão" },
      expirationDate: { id: options.ids.expirationDate, placeholder: "MM/AA" },
      securityCode: { id: options.ids.securityCode, placeholder: "CVV" },
      cardholderName: {
        id: options.ids.cardholderName,
        placeholder: "Nome impresso no cartão",
      },
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
    // Registra o controller como ativo logo após o sdk.cardForm() retornar.
    // (Atribuição abaixo, após declararmos `controller`.)
    callbacks: {
      onFormMounted: (error) => {
        if (error) {
          console.warn("[mercadopago] cardForm onFormMounted error", error);
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
  activeController = controller;

  return {
    submit(): Promise<TokenizedCardPayload> {
      return new Promise<TokenizedCardPayload>((resolve, reject) => {
        if (pending) {
          reject(new CardFormError("Submit já em andamento."));
          return;
        }
        pending = { resolve, reject };
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
      if (controller && activeController === controller) {
        activeController = null;
      }
      controller?.unmount();
      controller = null;
    },
  };
}
