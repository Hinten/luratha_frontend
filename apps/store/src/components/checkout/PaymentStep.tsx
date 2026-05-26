"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { payerFormSchema, type PayerFormInput } from "@luratha/schemas";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
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

    const payerEmail = formData.payer?.email ?? defaultEmail ?? "";
    const idType = (formData.payer?.identification?.type as "CPF" | "CNPJ" | undefined) ?? "CPF";
    const idNumber = (formData.payer?.identification?.number ?? "").replace(/\D/g, "");

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
          {/* O Card Payment Brick renderiza seu próprio form + botão Pagar
              dentro de um iframe hospedado pelo MercadoPago. A tokenização do
              cartão acontece na origem deles, então não há chamada do nosso
              domínio pra api.mercadopago.com/v1/card_tokens. */}
          <CardPayment
            initialization={{
              amount: cartTotal,
              ...(defaultEmail ? { payer: { email: defaultEmail } } : {}),
            }}
            customization={{
              paymentMethods: { maxInstallments: 12 },
            }}
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
