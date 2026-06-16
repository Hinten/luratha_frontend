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

/** Chaves de `MarketingSettings` cujo valor é string (renderizadas como input). */
type MarketingStringKey = {
  [K in keyof MarketingSettings]: MarketingSettings[K] extends string ? K : never;
}[keyof MarketingSettings];

type Field = {
  key: MarketingStringKey;
  label: string;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  /** Força maiúsculas ao digitar (ex.: Measurement ID GA4). */
  uppercase?: boolean;
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
        hint: "Injetado na loja (Consent Mode v2, modo opt-out). Vazio desliga a medição.",
        maxLength: 20,
        uppercase: true,
      },
    ],
  },
];

export function MarketingForm({ initialMarketing }: { initialMarketing: MarketingSettings }) {
  const router = useRouter();
  const [marketing, setMarketing] = useState<MarketingSettings>(initialMarketing);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  function patch(key: MarketingStringKey, value: string) {
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
          {group.title === "Meta (Facebook / Instagram)" && (
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={marketing.metaPixelEnabled}
                onChange={(e) => {
                  setMarketing((m) => ({ ...m, metaPixelEnabled: e.target.checked }));
                  setStatus({ kind: "idle" });
                }}
              />
              <span>
                <span className={styles.label}>Pixel + Conversions API ativos</span>
                <span className={styles.hint}>
                  Desmarque para pausar o Pixel (navegador) e a Conversions API (Purchase
                  server-side) sem perder o Pixel ID.
                </span>
              </span>
            </label>
          )}
          {group.title === "Google" && (
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={marketing.ga4Enabled}
                onChange={(e) => {
                  setMarketing((m) => ({ ...m, ga4Enabled: e.target.checked }));
                  setStatus({ kind: "idle" });
                }}
              />
              <span>
                <span className={styles.label}>Medição do GA4 ativa</span>
                <span className={styles.hint}>
                  Desmarque para pausar a coleta sem perder o Measurement ID.
                </span>
              </span>
            </label>
          )}
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
