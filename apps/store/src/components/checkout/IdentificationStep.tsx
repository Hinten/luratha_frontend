"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { payerFormSchema, type PayerFormInput } from "@luratha/schemas";
import { ApiResponseError } from "@/src/lib/errors";
import { reportCheckoutError } from "@/src/lib/checkoutErrors";
import { persistProfileFields } from "@/src/lib/checkout/persistProfileFields";
import { formatCnpj } from "@/src/lib/format/cnpj";
import { formatCpf } from "@/src/lib/format/cpf";
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
  const type = d.identificationType ?? "CPF";
  const rawNumber = d.identificationNumber ?? "";
  // Defaults vêm crus do UserProfile (CPF formatado "999.999.999-99" ou
  // CNPJ "99.999.999/9999-99") ou só dígitos. Re-aplicamos a máscara pra
  // garantir consistência com o que o usuário digita.
  const formattedNumber = type === "CNPJ" ? formatCnpj(rawNumber) : formatCpf(rawNumber);
  return {
    email: d.email ?? "",
    firstName: d.firstName ?? "",
    lastName: d.lastName ?? "",
    identificationType: type,
    identificationNumber: formattedNumber,
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
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<PayerFormInput>({
    resolver: zodResolver(payerFormSchema),
    mode: "onBlur",
    defaultValues: makeDefaults(props),
  });

  // Re-popula o form quando os defaults mudam após o mount. O CheckoutFlow
  // carrega o UserProfile assincronamente (fetch /api/users/{uid}) — sem este
  // reset, useForm fica preso aos valores vazios do primeiro render.
  //
  // Gate em !isDirty: se o usuário já começou a digitar (especialmente o CPF,
  // que é o campo mais "vazio" no primeiro render), NÃO sobrescreve o input
  // em andamento. Identificação é o primeiro step, então existe uma janela
  // de ~200-1000ms entre o mount e o fetch resolver onde o user pode estar
  // digitando — sem o gate, todo o input seria silenciosamente apagado.
  useEffect(() => {
    if (isDirty) return;
    reset(makeDefaults(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.defaults.email,
    props.defaults.firstName,
    props.defaults.lastName,
    props.defaults.identificationType,
    props.defaults.identificationNumber,
    reset,
    isDirty,
  ]);

  const idType = watch("identificationType");

  // Quando o usuário troca o tipo (CPF↔CNPJ), re-formata o número atual com
  // a máscara correspondente. Preservar os dígitos é importante: trocar CNPJ
  // (14 dígitos) → CPF não pode truncar silenciosamente os 3 últimos via
  // `formatCpf.slice(0,11)`. Quando o número atual excede o limite do novo
  // tipo, mantemos o valor cru e exibimos uma mensagem de erro pro usuário
  // editar — não destruímos dígitos pelas costas.
  useEffect(() => {
    const current = watch("identificationNumber") ?? "";
    const chars = current.replace(/[^A-Za-z0-9]/g, "");
    const maxChars = idType === "CNPJ" ? 14 : 11;
    // Letras só existem em CNPJ alfanumérico — trocar pra CPF com letras no
    // valor é tratado como "excede o formato" (formatCpf as descartaria).
    if (chars.length > maxChars || (idType === "CPF" && /[A-Za-z]/.test(chars))) {
      // Excede o novo formato — preserva o valor cru (mascarado pelo formato
      // anterior) pra dar pro user a chance de remover dígitos manualmente.
      // O Zod no submit já bloqueia caso ele tente avançar com tamanho errado.
      return;
    }
    const reformatted = idType === "CNPJ" ? formatCnpj(current) : formatCpf(current);
    if (reformatted !== current) {
      setValue("identificationNumber", reformatted, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idType]);

  async function processSubmit(values: PayerFormInput) {
    setError(null);
    setSubmitting(true);

    const payer: PaymentPayer = {
      email: values.email,
      firstName: values.firstName,
      lastName: values.lastName,
      identification: {
        type: values.identificationType,
        // Normalização por tipo: CPF é estritamente numérico; CNPJ pode ser
        // alfanumérico — remove só a pontuação da máscara e maiusculiza.
        number:
          values.identificationType === "CPF"
            ? values.identificationNumber.replace(/\D/g, "")
            : values.identificationNumber.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      },
    };

    try {
      await persistProfileFields(userId, payer);
      onSubmit(payer);
    } catch (err) {
      if (err instanceof ApiResponseError || err instanceof TypeError) {
        setError(reportCheckoutError({ error: err, step: "identification" }));
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
        Vamos usar essas informações pra emitir a nota fiscal e enviar as atualizações do seu
        pedido. Você só precisa preencher uma vez.
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
              inputMode={idType === "CNPJ" ? "text" : "numeric"}
              autoCapitalize="characters"
              maxLength={idType === "CNPJ" ? 18 : 14}
              aria-invalid={Boolean(errors.identificationNumber) || undefined}
              placeholder={idType === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"}
              {...register("identificationNumber", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  const formatted =
                    idType === "CNPJ" ? formatCnpj(e.target.value) : formatCpf(e.target.value);
                  setValue("identificationNumber", formatted, {
                    shouldValidate: false,
                  });
                },
              })}
            />
            <span className={styles.muted}>Pontos e traço são preenchidos automaticamente.</span>
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
