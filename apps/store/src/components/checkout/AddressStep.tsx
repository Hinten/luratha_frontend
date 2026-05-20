"use client";

import { useEffect, useState } from "react";
import type { Address } from "@luratha/schemas";
import AddressForm, {
  type AddressFormPayload,
} from "@/src/components/checkout/AddressForm";
import { ApiResponseError } from "@/src/lib/errors";
import styles from "./AddressStep.module.css";

export interface AddressStepProps {
  userId: string;
  selectedAddressId: string | null;
  onSelect: (address: Address) => void;
  onContinue: () => void;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "list"; addresses: Address[] }
  | { kind: "creating"; addresses: Address[] }
  | { kind: "error"; message: string };

export default function AddressStep({
  userId,
  selectedAddressId,
  onSelect,
  onContinue,
}: AddressStepProps) {
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/users/${userId}/addresses`);
      if (cancelled) return;
      if (!res.ok) {
        setState({
          kind: "error",
          message: "Não foi possível carregar seus endereços.",
        });
        return;
      }
      const addresses = (await res.json()) as Address[];
      if (cancelled) return;
      if (addresses.length === 0) {
        setState({ kind: "creating", addresses });
      } else {
        setState({ kind: "list", addresses });
        if (!selectedAddressId) {
          const preferred = addresses.find((a) => a.isDefault) ?? addresses[0];
          onSelect(preferred);
        }
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
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new ApiResponseError(
          body.message ?? "Falha ao salvar endereço.",
          res.status,
        );
      }
      const created = (await res.json()) as Address;
      const addresses = await refresh();
      setState({ kind: "list", addresses });
      onSelect(created);
    } catch (err) {
      if (err instanceof ApiResponseError) {
        setFormError(err.message);
      } else {
        throw err;
      }
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
          hideIsDefault
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
        onClick={() => setState({ kind: "creating", addresses: state.addresses })}
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
