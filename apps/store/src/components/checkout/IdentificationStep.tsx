"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { payerFormSchema, type PayerFormInput } from "@luratha/schemas";
import { ApiResponseError } from "@/src/lib/errors";
import { persistProfileFields } from "@/src/lib/checkout/persistProfileFields";
import type { PaymentPayer } from "@/src/components/checkout/PaymentStep";
import styles from "./IdentificationStep.module.css";

export interface IdentificationStepProps {
  userId: string;
  defaults: {
    email?: string;
    firstName?: string;
    lastName?: string;
    identificationType?: "CPF" | "CNPJ";
    /** CPF/CNPJ mascarado ou só dígitos — o form normaliza pra dígitos no submit. */
    identificationNumber?: string;
  };
  /** Chamado após o PATCH do UserProfile concluir com sucesso. */
  onSubmit: (payer: PaymentPayer) => void;
}

function makeDefaults(props: IdentificationStepProps): PayerFormInput {
  const d = props.defaults;
  return {
    email: d.email ?? "",
    firstName: d.firstName ?? "",
    lastName: d.lastName ?? "",
    identificationType: d.identificationType ?? "CPF",
    identificationNumber: d.identificationNumber ?? "",
    cardholderName: "",
  };
}

/**
 * Step 1 do checkout — coleta os dados pessoais do pagador (email, nome,
 * CPF/CNPJ) que antes ficavam duplicados no step de Pagamento. Os dados
 * alimentam o reducer central via `onSubmit`, e a Revisão exibe esse bloco
 * com botão Editar. PaymentStep consome do estado central — não recoleta.
 *
 * Persistência: ao avançar, faz **PATCH bloqueante** em `/api/users/{userId}`
 * pra salvar lastName + taxIdentity (CPF). Se falhar (4xx ou rede), o erro
 * é exibido inline e o user pode tentar de novo sem perder os dados do form.
 */
export default function IdentificationStep(props: IdentificationStepProps) {
  const { userId, onSubmit } = props;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<PayerFormInput>({
    resolver: zodResolver(payerFormSchema),
    mode: "onBlur",
    defaultValues: makeDefaults(props),
  });

  async function processSubmit(values: PayerFormInput) {
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
      await persistProfileFields(userId, payer);
      onSubmit(payer);
    } catch (err) {
      if (err instanceof ApiResponseError) {
        setError(err.message);
        return;
      }
      if (err instanceof TypeError) {
        setError("Sua conexão caiu ou está instável. Verifique a internet e tente novamente.");
        return;
      }
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Seus dados</h2>
      <p className={styles.intro}>
        Vamos usar essas informações pra emitir a nota fiscal e enviar as atualizações
        do seu pedido. Você só precisa preencher uma vez.
      </p>

      <form
        className={styles.form}
        onSubmit={(e) => {
          void handleSubmit(processSubmit)(e);
        }}
        noValidate
      >
        <div className={styles.field}>
          <label htmlFor="ident-email" className={styles.label}>
            E-mail
          </label>
          <input
            id="ident-email"
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
            <label htmlFor="ident-first" className={styles.label}>
              Nome
            </label>
            <input
              id="ident-first"
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
            <label htmlFor="ident-last" className={styles.label}>
              Sobrenome
            </label>
            <input
              id="ident-last"
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
            <label htmlFor="ident-id-type" className={styles.label}>
              Tipo de documento
            </label>
            <select
              id="ident-id-type"
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
            <label htmlFor="ident-id-number" className={styles.label}>
              Número do documento
            </label>
            <input
              id="ident-id-number"
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

        {error && (
          <p role="alert" className={styles.submitError}>
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? "Salvando…" : "Continuar"}
          </button>
        </div>
      </form>
    </section>
  );
}
