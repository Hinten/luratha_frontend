"use client";

import { useEffect, useState, type ChangeEvent, type FocusEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  addressFormSchema,
  UFS,
  UF_LABELS,
} from "@luratha/schemas";
import { formatCep } from "@/src/lib/format/cep";
import { lookupCep } from "@/src/lib/cep/viaCep";
import styles from "./AddressForm.module.css";

/**
 * Form de endereço reaproveitável entre `/conta/enderecos` e o Step 1 do
 * checkout. Não conhece API: recebe `onSubmit(payload)` e devolve um payload
 * já pronto para um `POST /api/users/[uid]/addresses` ou
 * `PATCH /api/users/[uid]/addresses/[id]`.
 *
 * Validação:
 *   - inline por campo via react-hook-form + zodResolver(addressFormSchema)
 *   - `mode: "onBlur"` — campo só mostra erro depois que o usuário sai dele
 *   - `serverIssues` (opcional) → cada `ZodIssue.path[0]` vira erro daquele
 *     campo; issues sem path mapeado caem no banner geral via `error`.
 */

export interface AddressFormInitialValues {
  label?: string;
  recipientName?: string;
  postalCode?: string;
  line1?: string;
  number?: string;
  complement?: string;
  reference?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  isDefault?: boolean;
}

export interface AddressFormPayload {
  recipientName: string;
  postalCode: string;
  line1: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  country: "BR";
  isDefault: boolean;
  label?: string;
  complement?: string;
  reference?: string;
  /** Código IBGE do município, preenchido pela consulta de CEP quando disponível. */
  ibgeCode?: string;
}

export interface AddressFormProps {
  initialValues?: AddressFormInitialValues;
  onSubmit: (payload: AddressFormPayload) => Promise<void> | void;
  onCancel?: () => void;
  saving?: boolean;
  /** Mensagem geral renderizada acima do botão de submit (erro do servidor). */
  error?: string | null;
  /** Issues do Zod devolvidos pelo backend em 400. Mapeados por campo. */
  serverIssues?: z.core.$ZodIssue[];
  title?: string;
  submitLabel?: string;
  cancelLabel?: string;
  /** Esconde o checkbox "tornar padrão" — útil no checkout, onde isso é decidido depois. */
  hideIsDefault?: boolean;
  /** Esconde o campo "Apelido" — útil no checkout (compra rápida) onde rótulo não importa. */
  hideLabel?: boolean;
}

type FormValues = z.infer<typeof addressFormSchema>;

/** Subconjunto dos campos do form que aceitam `setError` por nome. */
type FieldName = keyof FormValues;
const FIELD_NAMES: ReadonlySet<string> = new Set<FieldName>([
  "label",
  "recipientName",
  "postalCode",
  "line1",
  "number",
  "complement",
  "reference",
  "neighborhood",
  "city",
  "state",
  "isDefault",
]);

function toFormDefaults(initial?: AddressFormInitialValues): FormValues {
  return {
    label: initial?.label ?? "",
    recipientName: initial?.recipientName ?? "",
    postalCode: initial?.postalCode ?? "",
    line1: initial?.line1 ?? "",
    number: initial?.number ?? "",
    complement: initial?.complement ?? "",
    reference: initial?.reference ?? "",
    neighborhood: initial?.neighborhood ?? "",
    city: initial?.city ?? "",
    // String vazia para forçar o usuário a escolher uma UF no dropdown.
    // O Zod enum rejeita "" e cai no message "Selecione um estado.".
    state: (initial?.state ?? "") as FormValues["state"],
    isDefault: initial?.isDefault ?? false,
  };
}

function valuesToPayload(values: FormValues): AddressFormPayload {
  return {
    recipientName: values.recipientName,
    postalCode: values.postalCode,
    line1: values.line1,
    number: values.number,
    neighborhood: values.neighborhood,
    city: values.city,
    state: values.state,
    country: "BR",
    isDefault: values.isDefault,
    ...(values.label ? { label: values.label } : {}),
    ...(values.complement ? { complement: values.complement } : {}),
    ...(values.reference ? { reference: values.reference } : {}),
  };
}

export default function AddressForm({
  initialValues,
  onSubmit,
  onCancel,
  saving = false,
  error = null,
  serverIssues,
  title = "Endereço",
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  hideIsDefault = false,
  hideLabel = false,
}: AddressFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(addressFormSchema),
    mode: "onBlur",
    defaultValues: toFormDefaults(initialValues),
  });

  // Estado da consulta de CEP (ViaCEP): "loading" enquanto busca; "not_found" e
  // "error" só mostram AVISO (não bloqueiam o submit). O `ibgeCode` resolvido
  // entra no payload quando o CEP é encontrado.
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "not_found" | "error">(
    "idle",
  );
  const [ibgeCode, setIbgeCode] = useState<string | null>(null);

  // Mapeia issues do servidor (ZodIssue[]) para erros por campo.
  useEffect(() => {
    if (!serverIssues || serverIssues.length === 0) return;
    for (const issue of serverIssues) {
      const path = issue.path[0];
      if (typeof path === "string" && FIELD_NAMES.has(path)) {
        setError(path as FieldName, {
          type: "server",
          message: issue.message,
        });
      }
    }
  }, [serverIssues, setError]);

  const submit = handleSubmit((values) =>
    onSubmit({
      ...valuesToPayload(values),
      ...(ibgeCode ? { ibgeCode } : {}),
    }),
  );

  // CEP: mascara enquanto digita. Mutamos `e.target.value` antes do onChange
  // do RHF para que o estado do form receba o valor já formatado. Spread do
  // `register` cuida de name/ref/onBlur (acessar .ref no JSX direto dispara o
  // lint `react-hooks/refs`).
  const postalReg = register("postalCode");
  const onPostalChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = formatCep(e.target.value);
    // CEP mudou → invalida a consulta anterior (aviso some, ibge zera).
    setCepStatus("idle");
    setIbgeCode(null);
    void postalReg.onChange(e);
  };

  // Consulta o ViaCEP e autocompleta logradouro/bairro/cidade/UF + guarda o `ibge`.
  // "not_found"/"error" só viram aviso — a base do ViaCEP não é exaustiva, então
  // nunca bloqueamos o cadastro por isso. Reutilizada pelo blur e pelo botão "Buscar".
  const runCepLookup = async (rawCep: string) => {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepStatus("idle");
      return;
    }
    setCepStatus("loading");
    const result = await lookupCep(digits);
    if (result.status === "found") {
      setCepStatus("idle");
      setIbgeCode(/^\d{7}$/.test(result.ibge) ? result.ibge : null);
      // Só sobrescreve quando o ViaCEP traz o dado (alguns CEPs vêm sem logradouro).
      if (result.logradouro) setValue("line1", result.logradouro, { shouldValidate: true });
      if (result.bairro) setValue("neighborhood", result.bairro, { shouldValidate: true });
      setValue("city", result.localidade, { shouldValidate: true });
      setValue("state", result.uf as FormValues["state"], { shouldValidate: true });
    } else {
      setIbgeCode(null);
      setCepStatus(result.status);
    }
  };

  // Ao sair do campo CEP, dispara a consulta automaticamente.
  const onPostalBlur = (e: FocusEvent<HTMLInputElement>) => {
    void postalReg.onBlur(e); // preserva a validação de formato do RHF
    void runCepLookup(e.target.value);
  };

  // Gatilho manual (botão "Buscar") — fallback caso o blur não dispare (ex.: o
  // usuário cola o CEP e clica direto no botão).
  const onPostalLookupClick = () => {
    void runCepLookup(getValues("postalCode"));
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {title && <h3 className={styles.formTitle}>{title}</h3>}

      {!hideLabel && (
        <div className={styles.field}>
          <label htmlFor="address-label" className={styles.label}>
            Apelido (ex: Casa, Trabalho)
          </label>
          <input
            id="address-label"
            className={styles.input}
            aria-invalid={Boolean(errors.label) || undefined}
            {...register("label")}
          />
          {errors.label?.message && (
            <span role="alert" className={styles.fieldError}>
              {errors.label.message}
            </span>
          )}
        </div>
      )}

      <div className={styles.field}>
        <label htmlFor="address-recipient" className={styles.label}>
          Nome do destinatário
        </label>
        <input
          id="address-recipient"
          className={styles.input}
          aria-invalid={Boolean(errors.recipientName) || undefined}
          autoComplete="name"
          {...register("recipientName")}
        />
        {errors.recipientName?.message && (
          <span role="alert" className={styles.fieldError}>
            {errors.recipientName.message}
          </span>
        )}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="address-postal" className={styles.label}>
            CEP
          </label>
          <div className={styles.cepRow}>
            <input
              id="address-postal"
              className={styles.input}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              aria-invalid={Boolean(errors.postalCode) || undefined}
              {...postalReg}
              onChange={onPostalChange}
              onBlur={onPostalBlur}
            />
            <button
              type="button"
              className={styles.cepBtn}
              onClick={onPostalLookupClick}
              disabled={cepStatus === "loading"}
            >
              {cepStatus === "loading" ? "Buscando…" : "Buscar CEP"}
            </button>
          </div>
          {errors.postalCode?.message && (
            <span role="alert" className={styles.fieldError}>
              {errors.postalCode.message}
            </span>
          )}
          {!errors.postalCode && cepStatus === "not_found" && (
            <span role="status" className={styles.fieldHint}>
              Não encontramos esse CEP na base dos Correios. Confira se está correto.
            </span>
          )}
          {!errors.postalCode && cepStatus === "error" && (
            <span role="status" className={styles.fieldHint}>
              Não foi possível verificar o CEP agora. Confira os dados do endereço.
            </span>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="address-state" className={styles.label}>
            UF
          </label>
          <select
            id="address-state"
            className={styles.input}
            aria-invalid={Boolean(errors.state) || undefined}
            autoComplete="address-level1"
            {...register("state")}
          >
            <option value="">Selecione</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf} — {UF_LABELS[uf]}
              </option>
            ))}
          </select>
          {errors.state?.message && (
            <span role="alert" className={styles.fieldError}>
              {errors.state.message}
            </span>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="address-line1" className={styles.label}>
          Logradouro
        </label>
        <input
          id="address-line1"
          className={styles.input}
          autoComplete="address-line1"
          aria-invalid={Boolean(errors.line1) || undefined}
          {...register("line1")}
        />
        {errors.line1?.message && (
          <span role="alert" className={styles.fieldError}>
            {errors.line1.message}
          </span>
        )}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="address-number" className={styles.label}>
            Número
          </label>
          <input
            id="address-number"
            className={styles.input}
            placeholder="ou S/N"
            aria-invalid={Boolean(errors.number) || undefined}
            {...register("number")}
          />
          {errors.number?.message && (
            <span role="alert" className={styles.fieldError}>
              {errors.number.message}
            </span>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="address-complement" className={styles.label}>
            Complemento
          </label>
          <input
            id="address-complement"
            className={styles.input}
            placeholder="apto, bloco…"
            autoComplete="address-line2"
            aria-invalid={Boolean(errors.complement) || undefined}
            {...register("complement")}
          />
          {errors.complement?.message && (
            <span role="alert" className={styles.fieldError}>
              {errors.complement.message}
            </span>
          )}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="address-neighborhood" className={styles.label}>
          Bairro
        </label>
        <input
          id="address-neighborhood"
          className={styles.input}
          aria-invalid={Boolean(errors.neighborhood) || undefined}
          {...register("neighborhood")}
        />
        {errors.neighborhood?.message && (
          <span role="alert" className={styles.fieldError}>
            {errors.neighborhood.message}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="address-city" className={styles.label}>
          Cidade
        </label>
        <input
          id="address-city"
          className={styles.input}
          autoComplete="address-level2"
          aria-invalid={Boolean(errors.city) || undefined}
          {...register("city")}
        />
        {errors.city?.message && (
          <span role="alert" className={styles.fieldError}>
            {errors.city.message}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="address-reference" className={styles.label}>
          Ponto de referência (opcional)
        </label>
        <input
          id="address-reference"
          className={styles.input}
          aria-invalid={Boolean(errors.reference) || undefined}
          {...register("reference")}
        />
        {errors.reference?.message && (
          <span role="alert" className={styles.fieldError}>
            {errors.reference.message}
          </span>
        )}
      </div>

      {!hideIsDefault && (
        <label className={styles.checkboxRow}>
          <input type="checkbox" {...register("isDefault")} />
          Tornar este o endereço padrão
        </label>
      )}

      {error && (
        <p role="alert" className={styles.submitError}>
          {error}
        </p>
      )}

      <div className={styles.formActions}>
        {onCancel && (
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={saving}
          >
            {cancelLabel}
          </button>
        )}
        <button type="submit" className={styles.submitBtn} disabled={saving}>
          {saving ? "Salvando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
