"use client";

import { useState, type FormEvent } from "react";
import styles from "./AddressForm.module.css";

/**
 * Form de endereço reaproveitável entre `/conta/enderecos` e o Step 1 do
 * checkout. Não conhece API: recebe `onSubmit(payload)` e devolve um payload
 * já pronto para um `POST /api/users/[uid]/addresses` ou
 * `PATCH /api/users/[uid]/addresses/[id]`.
 *
 * O state dos inputs vive aqui (componente controlado). O pai controla apenas
 * `saving` (para desabilitar o submit) e `error` (mensagem de erro vinda do
 * backend para exibir no banner do form).
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
}

export interface AddressFormProps {
  initialValues?: AddressFormInitialValues;
  onSubmit: (payload: AddressFormPayload) => Promise<void> | void;
  onCancel?: () => void;
  saving?: boolean;
  error?: string | null;
  title?: string;
  submitLabel?: string;
  cancelLabel?: string;
  /** Esconde o checkbox "tornar padrão" — útil no checkout, onde isso é decidido depois. */
  hideIsDefault?: boolean;
}

interface FormState {
  label: string;
  recipientName: string;
  postalCode: string;
  line1: string;
  number: string;
  complement: string;
  reference: string;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
}

function toFormState(initial?: AddressFormInitialValues): FormState {
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
    state: initial?.state ?? "",
    isDefault: initial?.isDefault ?? false,
  };
}

function buildPayload(form: FormState): AddressFormPayload {
  return {
    recipientName: form.recipientName,
    postalCode: form.postalCode,
    line1: form.line1,
    number: form.number,
    neighborhood: form.neighborhood,
    city: form.city,
    state: form.state.toUpperCase(),
    country: "BR",
    isDefault: form.isDefault,
    ...(form.label ? { label: form.label } : {}),
    ...(form.complement ? { complement: form.complement } : {}),
    ...(form.reference ? { reference: form.reference } : {}),
  };
}

export default function AddressForm({
  initialValues,
  onSubmit,
  onCancel,
  saving = false,
  error = null,
  title = "Endereço",
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  hideIsDefault = false,
}: AddressFormProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(initialValues));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onSubmit(buildPayload(form));
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {title && <h3 className={styles.formTitle}>{title}</h3>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor="address-label" className={styles.label}>
          Apelido (ex: Casa, Trabalho)
        </label>
        <input
          id="address-label"
          className={styles.input}
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="address-recipient" className={styles.label}>
          Nome do destinatário
        </label>
        <input
          id="address-recipient"
          className={styles.input}
          value={form.recipientName}
          onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
          required
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="address-postal" className={styles.label}>
            CEP
          </label>
          <input
            id="address-postal"
            className={styles.input}
            value={form.postalCode}
            onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
            placeholder="00000-000"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="address-state" className={styles.label}>
            UF
          </label>
          <input
            id="address-state"
            className={styles.input}
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            maxLength={2}
            required
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="address-line1" className={styles.label}>
          Logradouro
        </label>
        <input
          id="address-line1"
          className={styles.input}
          value={form.line1}
          onChange={(e) => setForm({ ...form, line1: e.target.value })}
          required
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="address-number" className={styles.label}>
            Número
          </label>
          <input
            id="address-number"
            className={styles.input}
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
            placeholder="ou S/N"
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="address-complement" className={styles.label}>
            Complemento
          </label>
          <input
            id="address-complement"
            className={styles.input}
            value={form.complement}
            onChange={(e) => setForm({ ...form, complement: e.target.value })}
            placeholder="apto, bloco…"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="address-neighborhood" className={styles.label}>
          Bairro
        </label>
        <input
          id="address-neighborhood"
          className={styles.input}
          value={form.neighborhood}
          onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="address-city" className={styles.label}>
          Cidade
        </label>
        <input
          id="address-city"
          className={styles.input}
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="address-reference" className={styles.label}>
          Ponto de referência (opcional)
        </label>
        <input
          id="address-reference"
          className={styles.input}
          value={form.reference}
          onChange={(e) => setForm({ ...form, reference: e.target.value })}
        />
      </div>

      {!hideIsDefault && (
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
          Tornar este o endereço padrão
        </label>
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
