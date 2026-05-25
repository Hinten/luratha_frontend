"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { payerFormSchema, type PayerFormInput } from "@luratha/schemas";
import {
  mountCardForm,
  CardFormError,
  type CardFormHandle,
} from "@/src/lib/mercadopago/cardForm";
import { formatCpf } from "@/src/lib/format/cpf";
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

/**
 * IDs fixos que o cardForm SDK do MercadoPago usa pra ler campos do DOM.
 * Mantemos esses IDs **sempre** nos inputs (email/identificationType/
 * identificationNumber/cardholderName) — independente da aba ativa —
 * pra não ter que trocar atributos em runtime e pra o SDK funcionar
 * assim que monta.
 */
const CARD_FORM_IDS = {
  formId: "luratha-card-form",
  cardNumber: "luratha-card-number",
  expirationDate: "luratha-card-expiry",
  securityCode: "luratha-card-cvv",
  cardholderName: "luratha-card-name",
  issuer: "luratha-card-issuer",
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
   * Marca lazy-mount do cardForm: só vira `true` quando o usuário clica no
   * tab Cartão pela 1ª vez. Antes disso, o `cardBlock` nem está no DOM e o
   * SDK do MercadoPago não é invocado. Resolve o caso em que o usuário fica
   * no PIX/Boleto e nunca usa Cartão — sem isso, o erro "Context
   * 'expirationFields' already exists" aparece mesmo sem o user ir pro Cartão.
   * Uma vez montado, permanece vivo para tabs PIX↔Cartão↔Boleto não
   * re-disparar o SDK.
   */
  const [cardFormStarted, setCardFormStarted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<PayerFormInput>({
    resolver: zodResolver(payerFormSchema),
    mode: "onBlur",
    defaultValues: makeDefaults(props),
  });

  // Quando os defaults chegam tarde (CheckoutFlow ainda estava buscando o
  // UserProfile), reseta o form. Sem isso, o usuário veria os campos vazios
  // mesmo depois do profile carregar.
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

  // cardForm: lazy mount UMA vez por sessão do PaymentStep, no 1º clique no
  // tab Cartão. Antes disso o cardBlock nem está no DOM. Depois do 1º mount,
  // o cardBlock permanece vivo (com display:none nas outras abas), evitando
  // unmount/remount em toggles subsequentes. O singleton em cardForm.ts
  // protege contra double-mount do React Strict Mode em dev.
  const cardFormHandle = useRef<CardFormHandle | null>(null);
  useEffect(() => {
    if (!cardFormStarted) return;
    let cancelled = false;
    (async () => {
      try {
        const handle = await mountCardForm({
          amount: cartTotal,
          ids: CARD_FORM_IDS,
          onError: (err) => {
            setError(
              err instanceof Error
                ? err.message
                : "Erro ao carregar o formulário de cartão.",
            );
          },
        });
        if (cancelled) {
          handle.unmount();
          return;
        }
        cardFormHandle.current = handle;
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error) {
          setError(err.message);
        } else {
          throw err;
        }
      }
    })();
    return () => {
      cancelled = true;
      cardFormHandle.current?.unmount();
      cardFormHandle.current = null;
    };
    // cartTotal mudar depois (cupom aplicado em Revisão) NÃO re-monta o
    // cardForm — display de parcelas pode desatualizar, mas tokenização funciona.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardFormStarted]);

  // CPF mask while typing — UX brasileira. O input carrega o ID que o SDK
  // cardForm do MP lê no submit; pra evitar que o MP receba `123.456.789-09`
  // e rejeite com "invalid parameter identificationNumber" (code 324), o
  // `processSubmit` faz strip+restore do `.value` em torno do
  // `cardFormHandle.submit()`.
  const cpfReg = register("identificationNumber");
  const onCpfChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = formatCpf(e.target.value);
    void cpfReg.onChange(e);
  };

  async function processSubmit(values: PayerFormInput) {
    setError(null);
    setSubmitting(true);

    const basePayer: PaymentPayer = {
      email: values.email,
      identification: {
        type: values.identificationType,
        number: values.identificationNumber.replace(/\D/g, ""),
      },
      firstName: values.firstName,
      lastName: values.lastName,
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

      // credit_card: precisa do cardholderName preenchido + token do SDK.
      if (!values.cardholderName || values.cardholderName.trim().length === 0) {
        throw new CardFormError("Informe o nome impresso no cartão.");
      }
      if (!cardFormHandle.current) {
        throw new CardFormError("Formulário de cartão ainda não está pronto.");
      }

      // O SDK MP cardForm lê `.value` do input identificationNumber no
      // momento do submit (síncrono — não usa cache via event listener,
      // confirmado depois do debug do erro "324 invalid identificationNumber"
      // ser revelado como ARMOR/Firefox-ETP). Strip+restore simples: zera
      // a máscara antes do submit, restaura no finally pra UX preservar
      // `123.456.789-09` na tela.
      const cpfInput = document.getElementById(CARD_FORM_IDS.identificationNumber);
      let originalCpf: string | null = null;
      if (cpfInput instanceof HTMLInputElement) {
        originalCpf = cpfInput.value;
        cpfInput.value = originalCpf.replace(/\D/g, "");
      }
      try {
        const card = await cardFormHandle.current.submit();
        await onSubmit({
          paymentMethod: "credit_card",
          payer: { ...basePayer, email: card.cardholderEmail || basePayer.email },
          cardToken: card.token,
          installments: card.installments,
          paymentMethodId: card.paymentMethodId,
        });
      } finally {
        if (cpfInput instanceof HTMLInputElement && originalCpf !== null) {
          cpfInput.value = originalCpf;
        }
      }
    } catch (err) {
      if (err instanceof CardFormError) {
        setError(err.message);
        return;
      }
      // O SDK MP rejeita o submit do cardForm com um objeto cru estruturado
      // (ex.: `{ code: '324', message: 'invalid parameter ...' }`), que não é
      // CardFormError nem subclasse de Error. Sem este narrow por shape, o
      // erro escapa como unhandledRejection e o usuário fica preso em
      // "Processando…" sem feedback.
      if (typeof err === "object" && err !== null && "message" in err) {
        const e = err as { code?: unknown; message?: unknown };
        const msg =
          typeof e.message === "string"
            ? e.message
            : "Falha ao processar pagamento com cartão.";
        setError(`Erro do MercadoPago: ${msg}`);
        return;
      }
      throw err;
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
              // 1º clique em "Cartão" dispara o mount do cardForm SDK.
              // Permanece true depois disso — não desmontamos em tab switch.
              if (tab.id === "credit_card") {
                setCardFormStarted(true);
              } else {
                // Quando sai do cartão, limpa o cardholderName pra ele não bloquear
                // a validação dos outros métodos (campo é optional no schema).
                setValue("cardholderName", "", { shouldValidate: false });
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form
        id={CARD_FORM_IDS.formId}
        className={styles.form}
        onSubmit={(e) => {
          // Arrow garante que handleSubmit + processSubmit só são invocados no
          // submit (event-time), não durante render — silencia react-hooks/refs
          // sem perder a checagem de ref-access em outros pontos.
          void handleSubmit(processSubmit)(e);
        }}
        noValidate
      >
        <div className={styles.field}>
          <label htmlFor={CARD_FORM_IDS.cardholderEmail} className={styles.label}>
            E-mail do pagador
          </label>
          <input
            id={CARD_FORM_IDS.cardholderEmail}
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
            <label htmlFor={CARD_FORM_IDS.identificationType} className={styles.label}>
              Tipo de documento
            </label>
            <select
              id={CARD_FORM_IDS.identificationType}
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
            <label htmlFor={CARD_FORM_IDS.identificationNumber} className={styles.label}>
              Número do documento
            </label>
            <input
              id={CARD_FORM_IDS.identificationNumber}
              className={styles.input}
              inputMode="numeric"
              aria-invalid={Boolean(errors.identificationNumber) || undefined}
              placeholder={
                getValues("identificationType") === "CNPJ"
                  ? "00.000.000/0000-00"
                  : "000.000.000-00"
              }
              {...cpfReg}
              onChange={onCpfChange}
            />
            {errors.identificationNumber?.message && (
              <span role="alert" className={styles.fieldError}>
                {errors.identificationNumber.message}
              </span>
            )}
          </div>
        </div>

        {/*
          Bloco do Cartão — renderizado SOMENTE depois do 1º clique no tab
          Cartão (`cardFormStarted`). Antes disso, o SDK do MercadoPago não é
          invocado, e nenhum erro "Context expirationFields already exists"
          aparece para usuários que ficam só no PIX/Boleto.
          Após o 1º mount, fica vivo (display:none nas outras abas) para
          tabs PIX↔Cartão↔Boleto não dispararem unmount/remount.
        */}
        <div
          className={styles.cardBlock}
          style={{
            display:
              cardFormStarted && method === "credit_card" ? "flex" : "none",
          }}
          aria-hidden={method !== "credit_card"}
        >
          <div className={styles.field}>
            <label htmlFor={CARD_FORM_IDS.cardholderName} className={styles.label}>
              Nome impresso no cartão
            </label>
            <input
              id={CARD_FORM_IDS.cardholderName}
              className={styles.input}
              aria-invalid={Boolean(errors.cardholderName) || undefined}
              {...register("cardholderName")}
            />
            {errors.cardholderName?.message && (
              <span role="alert" className={styles.fieldError}>
                {errors.cardholderName.message}
              </span>
            )}
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
          {/* Issuer (banco emissor) — exigido pelo SDK MP no DOM mas
              populado automaticamente via BIN. Não interativo: escondido
              visualmente mas mantido ativo no DOM pra getElementById. */}
          <select
            id={CARD_FORM_IDS.issuer}
            className={styles.visuallyHidden}
            aria-hidden="true"
            tabIndex={-1}
            defaultValue=""
          >
            <option value="" disabled>
              Banco emissor
            </option>
          </select>
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
    </section>
  );
}
