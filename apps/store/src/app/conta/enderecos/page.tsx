"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Address } from "@luratha/schemas";
import AddressCard from "@/src/components/conta/AddressCard";
import AddressForm, {
  type AddressFormInitialValues,
  type AddressFormPayload,
} from "@/src/components/checkout/AddressForm";
import { ApiResponseError, throwIfNotOk } from "@/src/lib/errors";
import styles from "./page.module.css";

export default function EnderecosPage() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<z.core.$ZodIssue[]>([]);

  // Quando `editingId` é null e `showForm` true, é criação; com `editingId` é edição
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [initial, setInitial] = useState<AddressFormInitialValues | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const uid = user?.uid ?? null;

  async function refresh() {
    if (!uid) return;
    const res = await fetch(`/api/users/${uid}/addresses`);
    if (res.ok) {
      setAddresses((await res.json()) as Address[]);
    }
  }

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  function startCreate() {
    setEditingId(null);
    setInitial(undefined);
    setShowForm(true);
    setError(null);
    setServerIssues([]);
  }

  function startEdit(a: Address) {
    setEditingId(a.id);
    setInitial({
      label: a.label ?? "",
      recipientName: a.recipientName,
      postalCode: a.postalCode,
      line1: a.line1,
      number: a.number,
      complement: a.complement ?? "",
      reference: a.reference ?? "",
      neighborhood: a.neighborhood,
      city: a.city,
      state: a.state,
      isDefault: a.isDefault,
    });
    setShowForm(true);
    setError(null);
    setServerIssues([]);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
    setServerIssues([]);
  }

  async function handleSave(payload: AddressFormPayload) {
    if (!uid) return;
    setError(null);
    setServerIssues([]);
    setSaving(true);
    try {
      const url = editingId
        ? `/api/users/${uid}/addresses/${editingId}`
        : `/api/users/${uid}/addresses`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await throwIfNotOk(res, "Falha ao salvar endereço.");

      await refresh();
      cancelForm();
    } catch (err) {
      if (err instanceof ApiResponseError) {
        setError(err.message);
        setServerIssues(err.issues.slice());
      } else {
        throw err;
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(a: Address) {
    if (!uid) return;
    if (!confirm(`Excluir o endereço "${a.label ?? a.recipientName}"?`)) return;
    const res = await fetch(`/api/users/${uid}/addresses/${a.id}`, { method: "DELETE" });
    if (res.ok) await refresh();
  }

  async function handleSetDefault(a: Address) {
    if (!uid) return;
    const res = await fetch(`/api/users/${uid}/addresses/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    if (res.ok) await refresh();
  }

  if (!user) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.heading}>Endereços</h2>
        {!showForm && (
          <button type="button" className={styles.addBtn} onClick={startCreate}>
            + Adicionar endereço
          </button>
        )}
      </header>

      {showForm && (
        <div className={styles.formWrapper}>
          <AddressForm
            initialValues={initial}
            title={editingId ? "Editar endereço" : "Novo endereço"}
            submitLabel={editingId ? "Atualizar" : "Salvar"}
            cancelLabel="Cancelar"
            saving={saving}
            error={error}
            serverIssues={serverIssues}
            onSubmit={handleSave}
            onCancel={cancelForm}
          />
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Carregando…</p>
      ) : addresses.length === 0 ? (
        <p className={styles.muted}>Você ainda não cadastrou nenhum endereço.</p>
      ) : (
        <div className={styles.list}>
          {addresses.map((a) => (
            <AddressCard
              key={a.id}
              address={a}
              onEdit={startEdit}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          ))}
        </div>
      )}
    </div>
  );
}
