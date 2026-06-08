"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CompanySettings } from "@luratha/schemas";
import styles from "./CompanyForm.module.css";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Field = {
  key: keyof CompanySettings;
  label: string;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  uppercase?: boolean;
};

const FIELD_GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Identificação",
    fields: [
      { key: "legalName", label: "Razão social", placeholder: "Luratha Comércio de Roupas LTDA" },
      { key: "tradeName", label: "Nome fantasia", placeholder: "Luratha" },
      { key: "cnpj", label: "CNPJ", placeholder: "00.000.000/0001-00", maxLength: 20 },
    ],
  },
  {
    title: "Contato e privacidade (LGPD)",
    fields: [
      {
        key: "contactEmail",
        label: "E-mail de atendimento",
        placeholder: "contato@luratha.com.br",
      },
      {
        key: "dpoName",
        label: "Encarregado de Dados (DPO)",
        placeholder: "Nome do responsável",
        hint: "Exibido na Política de Privacidade (exigido pela LGPD, art. 41).",
      },
      { key: "dpoEmail", label: "E-mail do Encarregado (DPO)", placeholder: "dpo@luratha.com.br" },
    ],
  },
  {
    title: "Endereço e foro",
    fields: [
      { key: "addressLine", label: "Endereço da sede", placeholder: "Rua Exemplo, 123 — Bairro" },
      { key: "addressCity", label: "Município", placeholder: "São Paulo" },
      { key: "addressState", label: "UF", placeholder: "SP", maxLength: 2, uppercase: true },
      {
        key: "jurisdiction",
        label: "Comarca / Foro",
        placeholder: "São Paulo/SP",
        hint: "Foro de eleição exibido nos Termos de Uso.",
      },
    ],
  },
];

export function CompanyForm({ initialCompany }: { initialCompany: CompanySettings }) {
  const router = useRouter();
  const [company, setCompany] = useState<CompanySettings>(initialCompany);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function patch(key: keyof CompanySettings, value: string) {
    setCompany((c) => ({ ...c, [key]: value }));
    setStatus({ kind: "idle" });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setStatus({
          kind: "error",
          message: data.message ?? "Não foi possível salvar os dados da empresa.",
        });
        return;
      }
      setStatus({ kind: "saved" });
      router.refresh();
    } catch (err) {
      if (err instanceof TypeError) {
        setStatus({ kind: "error", message: "Falha de rede. Tente novamente." });
        return;
      }
      throw err;
    }
  }

  const saving = status.kind === "saving";

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className={styles.section}>
          <legend className={styles.sectionTitle}>{group.title}</legend>
          <div className={styles.grid}>
            {group.fields.map((field) => (
              <label key={field.key} className={styles.field}>
                <span className={styles.label}>{field.label}</span>
                <input
                  className={styles.input}
                  value={company[field.key]}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  onChange={(e) =>
                    patch(
                      field.key,
                      field.uppercase ? e.target.value.toUpperCase() : e.target.value,
                    )
                  }
                />
                {field.hint && <span className={styles.hint}>{field.hint}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={saving}>
          {saving ? "Salvando…" : "Salvar dados da empresa"}
        </button>
        {status.kind === "saved" && (
          <span role="status" className={styles.ok}>
            Dados salvos.
          </span>
        )}
        {status.kind === "error" && (
          <span role="alert" className={styles.error}>
            {status.message}
          </span>
        )}
      </div>
    </form>
  );
}
