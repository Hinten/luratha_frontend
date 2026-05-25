"use client";

import { loadMercadoPago } from "@mercadopago/sdk-js";

/**
 * Instancia única do MercadoPago no browser.
 *
 * O `@mercadopago/sdk-js` faz lazy-load do script oficial e adiciona o
 * construtor `MercadoPago` em `window`. Esta wrapper:
 *   - garante uma única chamada concorrente (cache + in-flight)
 *   - falha cedo se `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` não estiver configurada
 *   - usa locale pt-BR (público da loja)
 */

/**
 * Estilo aplicado dentro do iframe MP (cardNumber/expirationDate/securityCode).
 * O iframe vive em outro origin (sandbox PCI) — CSS externo do nosso CSS Module
 * não atravessa o boundary. A única forma de estilizar o conteúdo é via esta
 * config, repassada ao SDK na construção do cardForm. Propriedades aceitas
 * conforme docs MP `fields.md`.
 */
export interface CardFormFieldStyle {
  height?: string;
  width?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  color?: string;
  placeholderColor?: string;
  textAlign?: string;
  padding?: string;
  margin?: string;
}

interface CardFormFieldDef {
  id: string;
  placeholder?: string;
  style?: CardFormFieldStyle;
}

interface CardFormFormConfig {
  id: string;
  cardNumber: CardFormFieldDef;
  expirationDate: CardFormFieldDef;
  securityCode: CardFormFieldDef;
  cardholderName: CardFormFieldDef;
  /**
   * Banco emissor — obrigatório pela SDK. Sem este `<select>` no DOM o SDK
   * lança `"Required field 'issuer' is missing"` durante a detecção de BIN.
   * Populado automaticamente pelo SDK conforme o número do cartão é digitado;
   * normalmente vem uma única opção (auto-selecionada) pra cartões BR.
   */
  issuer: CardFormFieldDef;
  installments: CardFormFieldDef;
  identificationType: CardFormFieldDef;
  identificationNumber: CardFormFieldDef;
  cardholderEmail: CardFormFieldDef;
}

export interface CardFormCallbacks {
  onFormMounted?: (error?: unknown) => void;
  onSubmit?: (event: Event) => void;
  onError?: (error: unknown) => void;
  /**
   * Disparado quando o usuário digita o BIN (6 primeiros dígitos do PAN).
   * Útil pra confirmar que o iframe cardNumber está fluindo eventos
   * corretamente até o SDK. Sem isso, qualquer mudança no `style:` que
   * quebre o iframe é invisível.
   */
  onBinChange?: (bin: string) => void;
  onPaymentMethodsReceived?: (error: unknown, paymentMethods?: unknown) => void;
  onInstallmentsReceived?: (error: unknown, installments?: unknown) => void;
}

export interface CardFormConfig {
  amount: string;
  iframe?: boolean;
  form: CardFormFormConfig;
  callbacks: CardFormCallbacks;
}

export interface CardFormData {
  token: string;
  paymentMethodId: string;
  installments: string;
  cardholderEmail: string;
}

export interface CardFormController {
  getCardFormData(): CardFormData;
  unmount(): void;
}

export interface MercadoPagoInstance {
  cardForm(config: CardFormConfig): CardFormController;
}

type MercadoPagoConstructor = new (
  publicKey: string,
  options?: { locale?: string },
) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}

let cached: MercadoPagoInstance | null = null;
let inFlight: Promise<MercadoPagoInstance> | null = null;

export async function getMercadoPagoSdk(): Promise<MercadoPagoInstance> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error(
      "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY não configurado. Verifique o .env.",
    );
  }

  inFlight = (async () => {
    await loadMercadoPago();
    const Ctor = window.MercadoPago;
    if (!Ctor) {
      throw new Error(
        "SDK do MercadoPago carregou mas window.MercadoPago não está disponível.",
      );
    }
    cached = new Ctor(publicKey, { locale: "pt-BR" });
    return cached;
  })();

  return inFlight;
}

/** Reinicializa o cache — uso exclusivo em testes. */
export function __resetMercadoPagoSdkForTesting(): void {
  cached = null;
  inFlight = null;
}
