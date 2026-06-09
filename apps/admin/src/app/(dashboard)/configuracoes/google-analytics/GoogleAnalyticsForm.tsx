"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { GoogleSettings } from "@luratha/schemas";
import styles from "./GoogleAnalyticsForm.module.css";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function GoogleAnalyticsForm({ initialGoogle }: { initialGoogle: GoogleSettings }) {
  const router = useRouter();
  const [measurementId, setMeasurementId] = useState(initialGoogle.measurementId);
  const [enabled, setEnabled] = useState(initialGoogle.enabled);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google: { measurementId: measurementId.trim(), enabled } }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setStatus({
          kind: "error",
          message: data.message ?? "Não foi possível salvar a configuração do Google Analytics.",
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
      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Medição</legend>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span className={styles.label}>Measurement ID</span>
            <input
              className={styles.input}
              value={measurementId}
              placeholder="G-XXXXXXXXXX"
              maxLength={20}
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => {
                setMeasurementId(e.target.value.toUpperCase());
                setStatus({ kind: "idle" });
              }}
            />
            <span className={styles.hint}>
              Deixe em branco para desligar o analytics. Você encontra o ID em Administrador →
              Fluxos de dados, no painel do GA4.
            </span>
          </label>

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setStatus({ kind: "idle" });
              }}
            />
            <span>
              <span className={styles.label}>Medição ativa</span>
              <span className={styles.hint}>
                Desmarque para pausar a coleta sem perder o ID configurado.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={saving}>
          {saving ? "Salvando…" : "Salvar configuração"}
        </button>
        {status.kind === "saved" && (
          <span role="status" className={styles.ok}>
            Configuração salva.
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
