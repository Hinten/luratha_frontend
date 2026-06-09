"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MarketingSettings } from "@luratha/schemas";
import styles from "./MarketingForm.module.css";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Field = {
  key: keyof MarketingSettings;
  label: string;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
};

const FIELD_GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Meta (Facebook / Instagram)",
    fields: [
      {
        key: "metaPixelId",
        label: "Meta Pixel ID",
        placeholder: "123456789012345",
        hint: "Identificador do Pixel em Eventos do Meta (somente dígitos).",
        maxLength: 32,
      },
      {
        key: "facebookCatalogId",
        label: "ID do Catálogo do Facebook",
        placeholder: "987654321",
        hint: "Catálogo do Commerce Manager que recebe o feed de produtos.",
        maxLength: 32,
      },
    ],
  },
  {
    title: "Google",
    fields: [
      {
        key: "googleMerchantCenterId",
        label: "ID do Google Merchant Center",
        placeholder: "555000111",
        hint: "Conta do Merchant Center que consome o feed de produtos.",
        maxLength: 32,
      },
      {
        key: "ga4MeasurementId",
        label: "GA4 Measurement ID",
        placeholder: "G-XXXXXXXXXX",
        hint: "Measurement ID do Google Analytics 4.",
        maxLength: 20,
      },
    ],
  },
];

export function MarketingForm({ initialMarketing }: { initialMarketing: MarketingSettings }) {
  const router = useRouter();
  const [marketing, setMarketing] = useState<MarketingSettings>(initialMarketing);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function patch(key: keyof MarketingSettings, value: string) {
    setMarketing((m) => ({ ...m, [key]: value }));
    setStatus({ kind: "idle" });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketing }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setStatus({
          kind: "error",
          message: data.message ?? "Não foi possível salvar os identificadores de marketing.",
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
                  value={marketing[field.key]}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  onChange={(e) => patch(field.key, e.target.value)}
                />
                {field.hint && <span className={styles.hint}>{field.hint}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={saving}>
          {saving ? "Salvando…" : "Salvar identificadores"}
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
