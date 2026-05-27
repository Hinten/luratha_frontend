"use client";

import { useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import Spinner from "@/src/components/Spinner";
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
            onClick={() => {
              setMethod(tab.id);
              setError(null);
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
                  const msg =
                    err && typeof err === "object" && "message" in err
                      ? String((err as { message?: unknown }).message)
                      : "Erro ao processar pagamento com cartão.";
                  setError(msg);
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
        <div className={styles.form}>
          {method === "pix" && (
            <p className={styles.muted}>
              Você verá um QR Code para pagar com o app do seu banco. A confirmação
              costuma chegar em poucos minutos.
            </p>
          )}

          {method === "boleto" && (
            <p className={styles.muted}>
              O boleto será emitido com o endereço de entrega já informado.
              Compensação em até 3 dias úteis.
            </p>
          )}

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
              {submitting
                ? "Processando…"
                : method === "pix"
                  ? "Gerar PIX"
                  : "Gerar boleto"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
