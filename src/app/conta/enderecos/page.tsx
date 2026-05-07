"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Address } from "@/src/schemas/firestore";
import AddressCard from "@/src/components/conta/AddressCard";
import styles from "./page.module.css";

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

const emptyForm: FormState = {
  label: "",
  recipientName: "",
  postalCode: "",
  line1: "",
  number: "",
  complement: "",
  reference: "",
  neighborhood: "",
  city: "",
  state: "",
  isDefault: false,
};

export default function EnderecosPage() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state — quando `editingId` é null, é criação; senão, é edição
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
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
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function startEdit(a: Address) {
    setEditingId(a.id);
    setForm({
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
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!uid) return;
    setError(null);
    setSaving(true);

    const body: Record<string, unknown> = {
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

    try {
      const url = editingId
        ? `/api/users/${uid}/addresses/${editingId}`
        : `/api/users/${uid}/addresses`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = (await res.json()) as { message?: string };
        throw new Error(payload.message ?? "Falha ao salvar endereço.");
      }

      await refresh();
      cancelForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
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
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <h3 className={styles.formTitle}>
            {editingId ? "Editar endereço" : "Novo endereço"}
          </h3>
          {error && <p role="alert" className={styles.error}>{error}</p>}

          <div className={styles.field}>
            <label htmlFor="label" className={styles.label}>Apelido (ex: Casa, Trabalho)</label>
            <input id="label" className={styles.input} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>

          <div className={styles.field}>
            <label htmlFor="recipient" className={styles.label}>Nome do destinatário</label>
            <input id="recipient" className={styles.input} value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} required />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="postal" className={styles.label}>CEP</label>
              <input id="postal" className={styles.input} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} placeholder="00000-000" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="state" className={styles.label}>UF</label>
              <input id="state" className={styles.input} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} required />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="line1" className={styles.label}>Logradouro</label>
            <input id="line1" className={styles.input} value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="number" className={styles.label}>Número</label>
              <input id="number" className={styles.input} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="ou S/N" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="complement" className={styles.label}>Complemento</label>
              <input id="complement" className={styles.input} value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} placeholder="apto, bloco…" />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="neighborhood" className={styles.label}>Bairro</label>
            <input id="neighborhood" className={styles.input} value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} required />
          </div>

          <div className={styles.field}>
            <label htmlFor="city" className={styles.label}>Cidade</label>
            <input id="city" className={styles.input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
          </div>

          <div className={styles.field}>
            <label htmlFor="reference" className={styles.label}>Ponto de referência (opcional)</label>
            <input id="reference" className={styles.input} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            Tornar este o endereço padrão
          </label>

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={cancelForm} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? "Salvando…" : editingId ? "Atualizar" : "Salvar"}
            </button>
          </div>
        </form>
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
