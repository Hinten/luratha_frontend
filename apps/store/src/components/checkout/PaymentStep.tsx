"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { payerFormSchema, type PayerFormInput } from "@luratha/schemas";
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
  /** Defaults vindos do UserProfile carregado no CheckoutFlow. */
  defaultEmail?: string;
  defaultFirstName?: string;
  defaultLastName?: string;
  /** CPF mascarado (123.456.789-00) ou CNPJ mascarado. */
  defaultIdentificationNumber?: string;
  defaultIdentificationType?: "CPF" | "CNPJ";
  onSubmit: (payload: PaymentSubmitPayload) => Promise<void>;
  onBack: () => void;
}

const TABS: { id: PaymentMethod; label: string }[] = [
  { id: "pix", label: "PIX" },
  { id: "credit_card", label: "Cartão" },
  { id: "boleto", label: "Boleto" },
];

function makeDefaults(props: PaymentStepProps): PayerFormInput {
  return {
    email: props.defaultEmail ?? "",
    firstName: props.defaultFirstName ?? "",
    lastName: props.defaultLastName ?? "",
    identificationType: props.defaultIdentificationType ?? "CPF",
    identificationNumber: props.defaultIdentificationNumber ?? "",
    cardholderName: "",
  };
}

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
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
}

export default function PaymentStep(props: PaymentStepProps) {
  const {
    cartTotal,
    shippingAddress,
    defaultEmail,
    defaultFirstName,
    defaultLastName,
    defaultIdentificationNumber,
    defaultIdentificationType,
    onSubmit,
    onBack,
  } = props;

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

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<PayerFormInput>({
    resolver: zodResolver(payerFormSchema),
    mode: "onBlur",
    defaultValues: makeDefaults(props),
  });

  useEffect(() => {
    reset(makeDefaults(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    defaultEmail,
    defaultFirstName,
    defaultLastName,
    defaultIdentificationNumber,
    defaultIdentificationType,
    reset,
  ]);

  /**
   * Submit do form de payer (PIX/Boleto). O tab Cartão tem seu próprio submit
   * dentro do Brick — não passa por aqui.
   */
  async function processPayerSubmit(values: PayerFormInput) {
    setError(null);
    setSubmitting(true);

    const payer: PaymentPayer = {
      email: values.email,
      firstName: values.firstName,
      lastName: values.lastName,
      identification: {
        type: values.identificationType,
        number: values.identificationNumber.replace(/\D/g, ""),
      },
    };

    try {
      if (method === "pix") {
        await onSubmit({ paymentMethod: "pix", payer });
        return;
      }
      // boleto
      if (!shippingAddress) {
        setError("Endereço de entrega obrigatório para gerar boleto.");
        return;
      }
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
   * Submit do Card Payment Brick. O Brick coleta os dados do cartão + payer
   * dentro dos iframes hospedados em mercadopago.com e devolve o `formData`
   * já com o token gerado — não há chamada do nosso domínio pra `card_tokens`.
   */
  async function processCardSubmit(formData: CardBrickFormData) {
    setError(null);
    setSubmitting(true);

    // TODO: remove after card flow validated — log cru do Brick (com token
    // mascarado pra não vazar PCI no console).
    console.log("[checkout] Brick formData:", {
      ...formData,
      token: formData.token
        ? `${formData.token.slice(0, 6)}…${formData.token.slice(-4)}`
        : undefined,
    });

    const payerEmail = formData.payer?.email ?? defaultEmail ?? "";
    const idType = (formData.payer?.identification?.type as "CPF" | "CNPJ" | undefined) ?? "CPF";
    const brickIdNumber = (formData.payer?.identification?.number ?? "").replace(/\D/g, "");
    // Fallback pro CPF que o usuário cadastrou no perfil — quando o Brick
    // não inclui identification (perfil novo, Brick configurado sem o campo,
    // ou Brick devolve em outro lugar), tentamos o default propagado pelo
    // CheckoutFlow. Sem isso, o Zod do server rejeita com 400.
    const defaultIdDigits = (defaultIdentificationNumber ?? "").replace(/\D/g, "");
    const idNumber = brickIdNumber || defaultIdDigits;

    if (idNumber.length !== 11 && idNumber.length !== 14) {
      setSubmitting(false);
      setError(
        "Não recebemos seu CPF/CNPJ do formulário do Mercado Pago. Recarregue a página e preencha o documento antes de pagar.",
      );
      return;
    }

    try {
      await onSubmit({
        paymentMethod: "credit_card",
        payer: {
          email: payerEmail,
          firstName: defaultFirstName,
          lastName: defaultLastName,
          identification: { type: idType, number: idNumber },
        },
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
                  ...(defaultEmail ? { payer: { email: defaultEmail } } : {}),
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
        <form
          className={styles.form}
          onSubmit={(e) => {
            void handleSubmit(processPayerSubmit)(e);
          }}
          noValidate
        >
          <div className={styles.field}>
            <label htmlFor="payer-email" className={styles.label}>
              E-mail do pagador
            </label>
            <input
              id="payer-email"
              type="email"
              className={styles.input}
              autoComplete="email"
              aria-invalid={Boolean(errors.email) || undefined}
              {...register("email")}
            />
            {errors.email?.message && (
              <span role="alert" className={styles.fieldError}>
                {errors.email.message}
              </span>
            )}
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="payer-first" className={styles.label}>
                Nome
              </label>
              <input
                id="payer-first"
                className={styles.input}
                autoComplete="given-name"
                aria-invalid={Boolean(errors.firstName) || undefined}
                {...register("firstName")}
              />
              {errors.firstName?.message && (
                <span role="alert" className={styles.fieldError}>
                  {errors.firstName.message}
                </span>
              )}
            </div>
            <div className={styles.field}>
              <label htmlFor="payer-last" className={styles.label}>
                Sobrenome
              </label>
              <input
                id="payer-last"
                className={styles.input}
                autoComplete="family-name"
                aria-invalid={Boolean(errors.lastName) || undefined}
                {...register("lastName")}
              />
              {errors.lastName?.message && (
                <span role="alert" className={styles.fieldError}>
                  {errors.lastName.message}
                </span>
              )}
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="payer-id-type" className={styles.label}>
                Tipo de documento
              </label>
              <select
                id="payer-id-type"
                className={styles.input}
                aria-invalid={Boolean(errors.identificationType) || undefined}
                {...register("identificationType")}
              >
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
              </select>
              {errors.identificationType?.message && (
                <span role="alert" className={styles.fieldError}>
                  {errors.identificationType.message}
                </span>
              )}
            </div>
            <div className={styles.field}>
              <label htmlFor="payer-id-number" className={styles.label}>
                Número do documento
              </label>
              <input
                id="payer-id-number"
                className={styles.input}
                inputMode="numeric"
                pattern="\d*"
                maxLength={14}
                aria-invalid={Boolean(errors.identificationNumber) || undefined}
                placeholder={
                  getValues("identificationType") === "CNPJ"
                    ? "00000000000000"
                    : "00000000000"
                }
                {...register("identificationNumber")}
              />
              <span className={styles.muted}>
                Apenas números — sem pontos ou traços.
              </span>
              {errors.identificationNumber?.message && (
                <span role="alert" className={styles.fieldError}>
                  {errors.identificationNumber.message}
                </span>
              )}
            </div>
          </div>

          {method === "boleto" && (
            <p className={styles.muted}>
              O boleto será emitido com o endereço de entrega já informado.
              Compensação em até 3 dias úteis.
            </p>
          )}

          {method === "pix" && (
            <p className={styles.muted}>
              Você verá um QR Code para pagar com o app do seu banco. A confirmação
              costuma chegar em poucos minutos.
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
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? "Processando…" : "Confirmar pagamento"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
