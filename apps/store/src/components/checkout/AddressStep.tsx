"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import type { Address } from "@luratha/schemas";
import AddressForm, {
  type AddressFormPayload,
} from "@/src/components/checkout/AddressForm";
import { ApiResponseError, throwIfNotOk } from "@/src/lib/errors";
import { reportCheckoutError } from "@/src/lib/checkoutErrors";
import styles from "./AddressStep.module.css";

export interface AddressStepProps {
  userId: string;
  selectedAddressId: string | null;
  /** Nome do user logado — usado pra pré-preencher recipientName do form. */
  defaultRecipientName?: string;
  onSelect: (address: Address) => void;
  onContinue: () => void;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "list"; addresses: Address[] }
  /**
   * `wasInitiallyEmpty: true` quando o usuário caiu no form porque ainda
   * não tinha nenhum endereço (1ª compra). Nesse caso, salvar avança direto
   * pro Frete. `false` quando ele clicou "+ Adicionar" tendo outros já
   * salvos — aí volta pra lista com o novo selecionado pra ele revisar.
   */
  | { kind: "creating"; addresses: Address[]; wasInitiallyEmpty: boolean }
  | { kind: "error"; message: string };

export default function AddressStep({
  userId,
  selectedAddressId,
  defaultRecipientName,
  onSelect,
  onContinue,
}: AddressStepProps) {
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [formError, setFormError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<z.core.$ZodIssue[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/users/${userId}/addresses`);
        if (cancelled) return;
        await throwIfNotOk(res, "Não foi possível carregar seus endereços.");
        const addresses = (await res.json()) as Address[];
        if (cancelled) return;
        if (addresses.length === 0) {
          // 1ª compra do usuário — sem tela de seleção, vai direto pro form
          // e ao salvar pula pro Frete.
          setState({ kind: "creating", addresses, wasInitiallyEmpty: true });
        } else {
          setState({ kind: "list", addresses });
          if (!selectedAddressId) {
            const preferred = addresses.find((a) => a.isDefault) ?? addresses[0];
            onSelect(preferred);
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiResponseError || err instanceof TypeError) {
          setState({
            kind: "error",
            message: reportCheckoutError({ error: err, step: "address_load" }),
          });
          return;
        }
        throw err;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function refresh(): Promise<Address[]> {
    const res = await fetch(`/api/users/${userId}/addresses`);
    if (!res.ok) return [];
    return (await res.json()) as Address[];
  }

  async function handleCreate(payload: AddressFormPayload) {
    setFormError(null);
    setServerIssues([]);
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // throwIfNotOk extrai `message` + `errors` (ZodIssue[]) do body 400; no-op
      // se res.ok.
      await throwIfNotOk(res, "Falha ao salvar endereço.");
      const created = (await res.json()) as Address;
      onSelect(created);
      // 1º endereço (wasInitiallyEmpty): avança direto pro Frete sem mostrar lista.
      // Caso contrário, volta pra lista com o recém-criado selecionado.
      if (state.kind === "creating" && state.wasInitiallyEmpty) {
        onContinue();
        return;
      }
      const addresses = await refresh();
      setState({ kind: "list", addresses });
    } catch (err) {
      if (err instanceof ApiResponseError) {
        const hasFieldIssues = err.issues.length > 0;
        setFormError(
          reportCheckoutError({
            error: err,
            step: "address_save",
            metadata: { hasFieldIssues },
          }),
        );
        setServerIssues(err.issues.slice());
        return;
      }
      if (err instanceof TypeError) {
        setFormError(reportCheckoutError({ error: err, step: "address_save" }));
        return;
      }
      throw err;
    } finally {
      setSaving(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <section className={styles.section}>
        <p className={styles.muted}>Carregando endereços…</p>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section className={styles.section}>
        <p role="alert" className={styles.error}>
          {state.message}
        </p>
      </section>
    );
  }

  if (state.kind === "creating") {
    return (
      <section className={styles.section}>
        <h2 className={styles.heading}>Para onde enviamos seu pedido?</h2>
        <p className={styles.muted}>
          Você ainda não cadastrou um endereço. Adicione um para continuar.
        </p>
        <AddressForm
          title="Novo endereço"
          submitLabel="Salvar endereço"
          saving={saving}
          error={formError}
          serverIssues={serverIssues}
          hideIsDefault
          hideLabel
          initialValues={
            defaultRecipientName ? { recipientName: defaultRecipientName } : undefined
          }
          onSubmit={handleCreate}
        />
      </section>
    );
  }

  // state.kind === "list"
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Para onde enviamos seu pedido?</h2>
      <div className={styles.list} role="radiogroup" aria-label="Endereço de entrega">
        {state.addresses.map((a) => {
          const checked = a.id === selectedAddressId;
          return (
            <label
              key={a.id}
              className={styles.option}
              data-checked={checked || undefined}
            >
              <input
                type="radio"
                name="address"
                className={styles.radio}
                checked={checked}
                onChange={() => onSelect(a)}
              />
              <div className={styles.optionBody}>
                <p className={styles.optionTitle}>
                  {a.label ?? a.recipientName}
                  {a.isDefault && <span className={styles.badge}>Padrão</span>}
                </p>
                <p className={styles.optionLine}>{a.recipientName}</p>
                <p className={styles.optionLine}>
                  {a.line1}, {a.number}
                  {a.complement ? ` — ${a.complement}` : ""}
                </p>
                <p className={styles.optionLine}>
                  {a.neighborhood} · {a.city}/{a.state} · CEP {a.postalCode}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      <button
        type="button"
        className={styles.addBtn}
        onClick={() =>
          setState({
            kind: "creating",
            addresses: state.addresses,
            wasInitiallyEmpty: false,
          })
        }
      >
        + Adicionar novo endereço
      </button>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.continueBtn}
          onClick={onContinue}
          disabled={!selectedAddressId}
        >
          Continuar
        </button>
      </div>
    </section>
  );
}
