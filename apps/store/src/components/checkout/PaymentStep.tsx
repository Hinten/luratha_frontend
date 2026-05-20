"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  mountCardForm,
  CardFormError,
  type CardFormHandle,
} from "@/src/lib/mercadopago/cardForm";
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
  /** Pré-preenchido com o nome do destinatário do endereço escolhido. */
  defaultRecipientName?: string;
  /** Endereço escolhido — usado para autopopular o payerAddress no boleto. */
  shippingAddress?: {
    postalCode: string;
    line1: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  onSubmit: (payload: PaymentSubmitPayload) => Promise<void>;
  onBack: () => void;
}

interface PayerFormState {
  email: string;
  firstName: string;
  lastName: string;
  identificationType: "CPF" | "CNPJ";
  identificationNumber: string;
}

const CARD_FORM_IDS = {
  formId: "luratha-card-form",
  cardNumber: "luratha-card-number",
  expirationDate: "luratha-card-expiry",
  securityCode: "luratha-card-cvv",
  cardholderName: "luratha-card-name",
  installments: "luratha-card-installments",
  identificationType: "luratha-card-id-type",
  identificationNumber: "luratha-card-id-number",
  cardholderEmail: "luratha-card-email",
};

const TABS: { id: PaymentMethod; label: string }[] = [
  { id: "pix", label: "PIX" },
  { id: "credit_card", label: "Cartão" },
  { id: "boleto", label: "Boleto" },
];

function splitName(full: string): { firstName: string; lastName: string } {
  const trimmed = full.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export default function PaymentStep({
  cartTotal,
  defaultRecipientName,
  shippingAddress,
  onSubmit,
  onBack,
}: PaymentStepProps) {
  const split = defaultRecipientName ? splitName(defaultRecipientName) : null;

  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [payer, setPayer] = useState<PayerFormState>({
    email: "",
    firstName: split?.firstName ?? "",
    lastName: split?.lastName ?? "",
    identificationType: "CPF",
    identificationNumber: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardFormHandle = useRef<CardFormHandle | null>(null);

  useEffect(() => {
    if (method !== "credit_card") {
      cardFormHandle.current?.unmount();
      cardFormHandle.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const handle = await mountCardForm({
        amount: cartTotal,
        ids: CARD_FORM_IDS,
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Erro ao carregar o formulário de cartão.");
        },
      });
      if (cancelled) {
        handle.unmount();
        return;
      }
      cardFormHandle.current = handle;
    })().catch((err) => {
      if (!cancelled) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar o SDK do MercadoPago.",
        );
      }
    });
    return () => {
      cancelled = true;
      cardFormHandle.current?.unmount();
      cardFormHandle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const basePayer: PaymentPayer = {
      email: payer.email,
      identification: {
        type: payer.identificationType,
        number: payer.identificationNumber.replace(/\D/g, ""),
      },
      ...(payer.firstName ? { firstName: payer.firstName } : {}),
      ...(payer.lastName ? { lastName: payer.lastName } : {}),
    };

    try {
      if (method === "pix") {
        await onSubmit({ paymentMethod: "pix", payer: basePayer });
        return;
      }

      if (method === "boleto") {
        if (!shippingAddress) {
          throw new CardFormError(
            "Endereço de entrega obrigatório para gerar boleto.",
          );
        }
        await onSubmit({
          paymentMethod: "boleto",
          payer: basePayer,
          payerAddress: {
            zipCode: shippingAddress.postalCode,
            streetName: shippingAddress.line1,
            streetNumber: shippingAddress.number,
            neighborhood: shippingAddress.neighborhood,
            city: shippingAddress.city,
            federalUnit: shippingAddress.state.toUpperCase(),
          },
        });
        return;
      }

      // credit_card
      if (!cardFormHandle.current) {
        throw new CardFormError("Formulário de cartão ainda não está pronto.");
      }
      const card = await cardFormHandle.current.submit();
      await onSubmit({
        paymentMethod: "credit_card",
        payer: { ...basePayer, email: card.cardholderEmail || basePayer.email },
        cardToken: card.token,
        installments: card.installments,
        paymentMethodId: card.paymentMethodId,
      });
    } catch (err) {
      if (err instanceof CardFormError || err instanceof Error) {
        setError(err.message);
      } else {
        throw err;
      }
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

      <form id={CARD_FORM_IDS.formId} className={styles.form} onSubmit={handleSubmit} noValidate>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <div className={styles.field}>
          <label htmlFor="payer-email" className={styles.label}>
            E-mail do pagador
          </label>
          <input
            id={method === "credit_card" ? CARD_FORM_IDS.cardholderEmail : "payer-email"}
            type="email"
            className={styles.input}
            value={payer.email}
            onChange={(e) => setPayer({ ...payer, email: e.target.value })}
            required
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="payer-first" className={styles.label}>
              Nome
            </label>
            <input
              id="payer-first"
              className={styles.input}
              value={payer.firstName}
              onChange={(e) => setPayer({ ...payer, firstName: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="payer-last" className={styles.label}>
              Sobrenome
            </label>
            <input
              id="payer-last"
              className={styles.input}
              value={payer.lastName}
              onChange={(e) => setPayer({ ...payer, lastName: e.target.value })}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label
              htmlFor={method === "credit_card" ? CARD_FORM_IDS.identificationType : "payer-doc-type"}
              className={styles.label}
            >
              Tipo de documento
            </label>
            <select
              id={method === "credit_card" ? CARD_FORM_IDS.identificationType : "payer-doc-type"}
              className={styles.input}
              value={payer.identificationType}
              onChange={(e) =>
                setPayer({
                  ...payer,
                  identificationType: e.target.value as "CPF" | "CNPJ",
                })
              }
            >
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
            </select>
          </div>
          <div className={styles.field}>
            <label
              htmlFor={method === "credit_card" ? CARD_FORM_IDS.identificationNumber : "payer-doc-number"}
              className={styles.label}
            >
              Número do documento
            </label>
            <input
              id={method === "credit_card" ? CARD_FORM_IDS.identificationNumber : "payer-doc-number"}
              className={styles.input}
              value={payer.identificationNumber}
              onChange={(e) =>
                setPayer({ ...payer, identificationNumber: e.target.value })
              }
              required
            />
          </div>
        </div>

        {method === "credit_card" && (
          <div className={styles.cardBlock}>
            <div className={styles.field}>
              <label htmlFor={CARD_FORM_IDS.cardholderName} className={styles.label}>
                Nome impresso no cartão
              </label>
              <input
                id={CARD_FORM_IDS.cardholderName}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={CARD_FORM_IDS.cardNumber} className={styles.label}>
                Número do cartão
              </label>
              <div id={CARD_FORM_IDS.cardNumber} className={styles.iframeMount} />
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor={CARD_FORM_IDS.expirationDate} className={styles.label}>
                  Validade
                </label>
                <div id={CARD_FORM_IDS.expirationDate} className={styles.iframeMount} />
              </div>
              <div className={styles.field}>
                <label htmlFor={CARD_FORM_IDS.securityCode} className={styles.label}>
                  CVV
                </label>
                <div id={CARD_FORM_IDS.securityCode} className={styles.iframeMount} />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor={CARD_FORM_IDS.installments} className={styles.label}>
                Parcelas
              </label>
              <select
                id={CARD_FORM_IDS.installments}
                className={styles.input}
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione
                </option>
              </select>
            </div>
            <p className={styles.muted}>
              Os campos número, validade e CVV são processados em segurança pelo
              MercadoPago.
            </p>
          </div>
        )}

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
    </section>
  );
}
