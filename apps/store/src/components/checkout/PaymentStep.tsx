"use client";

import { useState, type ReactElement } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import Spinner from "@/src/components/Spinner";
import { reportCheckoutError } from "@/src/lib/checkoutErrors";
import styles from "./PaymentStep.module.css";

export type PaymentMethod = "pix" | "credit_card" | "boleto";

export interface PaymentPayer {
  email: string;
  firstName?: string;
  lastName?: string;
  identification: { type: "CPF" | "CNPJ"; number: string };
}

export interface PaymentPayerAddress {
  zipCode: string;
  streetName: string;
  streetNumber: string;
  neighborhood: string;
  city: string;
  federalUnit: string;
}

export type PaymentSubmitPayload =
  | { paymentMethod: "pix"; payer: PaymentPayer }
  | {
      paymentMethod: "credit_card";
      payer: PaymentPayer;
      cardToken: string;
      installments: number;
      paymentMethodId: string;
    }
  | { paymentMethod: "boleto"; payer: PaymentPayer; payerAddress: PaymentPayerAddress };

export interface PaymentStepProps {
  cartTotal: number;
  /** Endereço escolhido — usado pra autopopular o payerAddress no boleto. */
  shippingAddress?: {
    postalCode: string;
    line1: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  /** Dados do pagador já confirmados no step "Seus dados". */
  payer: PaymentPayer;
  onSubmit: (payload: PaymentSubmitPayload) => Promise<void>;
  onBack: () => void;
}

const TABS: { id: PaymentMethod; label: string }[] = [
  { id: "pix", label: "PIX" },
  { id: "credit_card", label: "Cartão" },
  { id: "boleto", label: "Boleto" },
];

/**
 * `initMercadoPago` é idempotente — múltiplas chamadas com a mesma chave são
 * no-op. Chamamos uma vez no module-load pra garantir que o Brick consiga
 * renderizar assim que o tab Cartão for selecionado.
 *
 * A public key vem do bundle (NEXT_PUBLIC_*, inlinada em build time). Quando
 * ausente — ex.: dev sem .env.local — o Brick falha em runtime; preferimos isso
 * a falhar no import porque PIX/Boleto continuam funcionando.
 */
const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";
if (typeof window !== "undefined" && MP_PUBLIC_KEY) {
  initMercadoPago(MP_PUBLIC_KEY, { locale: "pt-BR" });
}

/** Ícone de cadeado — comunica segurança no overlay do Brick. */
function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** Ícone PIX — quadrados nos 4 cantos formando o logo do PIX. */
function PixIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9.4 3.6 3.6 9.4a3.6 3.6 0 0 0 0 5.2l5.8 5.8a3.6 3.6 0 0 0 5.2 0l5.8-5.8a3.6 3.6 0 0 0 0-5.2L14.6 3.6a3.6 3.6 0 0 0-5.2 0Z" />
      <path d="m7 9 3.5 3.5a2 2 0 0 0 2.8 0L17 9" />
      <path d="m7 15 3.5-3.5a2 2 0 0 1 2.8 0L17 15" />
    </svg>
  );
}

/** Ícone do Boleto — código de barras estilizado. */
function BoletoIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <line x1="7" y1="9" x2="7" y2="15" />
      <line x1="9.5" y1="9" x2="9.5" y2="15" strokeWidth="2.5" />
      <line x1="12.5" y1="9" x2="12.5" y2="15" />
      <line x1="15" y1="9" x2="15" y2="15" strokeWidth="2.5" />
      <line x1="17.5" y1="9" x2="17.5" y2="15" />
    </svg>
  );
}

/** Checkmark dentro de um círculo — usado nas listas de benefícios. */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

interface MethodInfo {
  Icon: (props: { className?: string }) => ReactElement;
  title: string;
  subtitle: string;
  benefits: string[];
  ctaLabel: string;
  ctaProcessingLabel: string;
}

const PIX_INFO: MethodInfo = {
  Icon: PixIcon,
  title: "Pagamento via PIX",
  subtitle: "Confirmação em minutos",
  benefits: [
    "QR Code seguro gerado pelo Mercado Pago",
    "Pagamento confirmado em até 2 minutos",
    "Sem taxas ou custos adicionais",
  ],
  ctaLabel: "Gerar PIX",
  ctaProcessingLabel: "Gerando PIX…",
};

const BOLETO_INFO: MethodInfo = {
  Icon: BoletoIcon,
  title: "Boleto bancário",
  subtitle: "Compensação em até 3 dias úteis",
  benefits: [
    "Pague em qualquer banco, app ou casa lotérica",
    "Vencimento em 3 dias úteis a partir da emissão",
    "Sem custos adicionais — só o valor do pedido",
  ],
  ctaLabel: "Gerar boleto",
  ctaProcessingLabel: "Gerando boleto…",
};

/** Shape mínimo do payload que o Card Payment Brick devolve em `onSubmit`. */
interface CardBrickFormData {
  token: string;
  payment_method_id: string;
  installments: number;
}

export default function PaymentStep(props: PaymentStepProps) {
  const { cartTotal, shippingAddress, payer, onSubmit, onBack } = props;

  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * `brickReady` vira true quando o `onReady` do CardPayment dispara — ou
   * seja, quando os iframes do Brick terminaram de carregar e o form de
   * cartão está pronto. Enquanto false, mostramos um overlay com cadeado
   * pra evitar o "quadrado em branco" durante os ~2s de mount inicial.
   */
  const [brickReady, setBrickReady] = useState(false);

  async function submitPix() {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ paymentMethod: "pix", payer });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitBoleto() {
    setError(null);
    if (!shippingAddress) {
      setError("Endereço de entrega obrigatório para gerar boleto.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        paymentMethod: "boleto",
        payer,
        payerAddress: {
          zipCode: shippingAddress.postalCode,
          streetName: shippingAddress.line1,
          streetNumber: shippingAddress.number,
          neighborhood: shippingAddress.neighborhood,
          city: shippingAddress.city,
          federalUnit: shippingAddress.state.toUpperCase(),
        },
      });
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Submit do Card Payment Brick. O Brick coleta o cartão dentro dos iframes
   * hospedados em mercadopago.com e devolve `token` + `payment_method_id` +
   * `installments`. Os dados de payer **não** vêm daqui — usamos o `payer`
   * prop (já validado no step "Seus dados" e pré-preenchido no Brick via
   * `initialization.payer`).
   */
  async function processCardSubmit(formData: CardBrickFormData) {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        paymentMethod: "credit_card",
        payer,
        cardToken: formData.token,
        installments: formData.installments,
        paymentMethodId: formData.payment_method_id,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Como você quer pagar?</h2>

      <div className={styles.tabs} role="tablist" aria-label="Método de pagamento">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={method === tab.id}
            className={styles.tab}
            data-active={method === tab.id || undefined}
            // Bloqueia troca de tab enquanto um submit está em voo. Sem isso, o
            // PIX/Boleto pode resolver depois do user trocar pra Cartão e o
            // CheckoutFlow dispatcha SUBMIT_OK → activeStep vira "result"
            // mostrando o PaymentResult que o user nem queria.
            disabled={submitting}
            onClick={() => {
              setMethod(tab.id);
              setError(null);
              // Ao re-entrar no tab Cartão, o <CardPayment> desmonta+remonta
              // (ternary swap). Sem reset, brickReady fica "true" stale do
              // mount anterior e o overlay de "Carregando ambiente seguro"
              // não renderiza durante os ~2s do segundo fetch dos iframes.
              if (tab.id === "credit_card") {
                setBrickReady(false);
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {method === "credit_card" ? (
        <div className={styles.form} aria-label="Pagamento com cartão">
          {error && (
            <p role="alert" className={styles.submitError}>
              {error}
            </p>
          )}
          {/* Container relativo pro overlay sobrepor o Brick durante o mount
              (evita o "quadrado em branco") e durante o submit (feedback
              visual entre o tokenize e o redirect). */}
          <div className={styles.brickContainer}>
            {/* O Brick fica oculto via visibility até onReady disparar; mantemos
                ele no DOM pra não desmontar/remontar (cada remount = novo
                fetch dos iframes seguros). */}
            <div
              className={styles.brickMount}
              style={{ visibility: brickReady ? "visible" : "hidden" }}
            >
              <CardPayment
                initialization={{
                  amount: cartTotal,
                  payer: {
                    email: payer.email,
                    ...(payer.firstName ? { firstName: payer.firstName } : {}),
                    ...(payer.lastName ? { lastName: payer.lastName } : {}),
                    identification: {
                      type: payer.identification.type,
                      number: payer.identification.number,
                    },
                  },
                }}
                customization={{
                  paymentMethods: { maxInstallments: 12 },
                }}
                onReady={() => setBrickReady(true)}
                onSubmit={async (param) => {
                  await processCardSubmit(param as unknown as CardBrickFormData);
                }}
                onError={(err) => {
                  // O Brick passa objetos plain (não Error) e props
                  // diagnósticas úteis (`cause`, `code`) podem ser
                  // não-enumeráveis — capturamos via Object.getOwnPropertyNames
                  // pra não perder sinal no log. Ver doc Bricks "Possíveis
                  // erros": fields_setup_failed, card_token_creation_failed,
                  // get_payment_methods_failed, etc. Estruturas circulares
                  // (cause → DOM) são tratadas pelo logger, que faz fallback
                  // pra String() quando JSON.stringify lança.
                  const brickPayload =
                    err && typeof err === "object"
                      ? Object.fromEntries(
                          Object.getOwnPropertyNames(err).map((k) => [
                            k,
                            (err as unknown as Record<string, unknown>)[k],
                          ]),
                        )
                      : err;
                  setError(
                    reportCheckoutError({
                      error: err,
                      step: "payment_card",
                      metadata: { brickPayload },
                    }),
                  );
                }}
              />
            </div>

            {!brickReady && (
              <div className={styles.brickOverlay} aria-live="polite">
                <LockIcon className={styles.lockIcon} />
                <p className={styles.overlayTitle}>
                  Carregando ambiente seguro de pagamento
                </p>
                <p className={styles.overlaySubtitle}>
                  Conexão criptografada com o Mercado Pago
                </p>
                <Spinner size={20} className={styles.overlaySpinner} />
              </div>
            )}

            {brickReady && submitting && (
              <div className={styles.brickOverlay} aria-live="polite">
                <LockIcon className={styles.lockIcon} />
                <p className={styles.overlayTitle}>Processando pagamento…</p>
                <p className={styles.overlaySubtitle}>
                  Não feche esta janela — você será redirecionado
                </p>
                <Spinner size={20} className={styles.overlaySpinner} />
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={onBack}
              disabled={submitting}
            >
              Voltar
            </button>
          </div>
        </div>
      ) : (
        (() => {
          const info = method === "pix" ? PIX_INFO : BOLETO_INFO;
          const { Icon } = info;
          return (
            <div className={styles.form}>
              <div className={styles.methodCard}>
                <div className={styles.methodHeader}>
                  <Icon className={styles.methodIcon} />
                  <div className={styles.methodHeaderText}>
                    <h3 className={styles.methodTitle}>{info.title}</h3>
                    <p className={styles.methodSubtitle}>{info.subtitle}</p>
                  </div>
                </div>
                <ul className={styles.benefits}>
                  {info.benefits.map((text) => (
                    <li key={text} className={styles.benefit}>
                      <CheckIcon className={styles.benefitIcon} />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {error && (
                <p role="alert" className={styles.submitError}>
                  {error}
                </p>
              )}

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.backBtn}
                  onClick={onBack}
                  disabled={submitting}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className={styles.submitBtn}
                  disabled={submitting}
                  onClick={() => {
                    if (method === "pix") {
                      void submitPix();
                    } else {
                      void submitBoleto();
                    }
                  }}
                >
                  {submitting ? info.ctaProcessingLabel : info.ctaLabel}
                </button>
              </div>
            </div>
          );
        })()
      )}
    </section>
  );
}
