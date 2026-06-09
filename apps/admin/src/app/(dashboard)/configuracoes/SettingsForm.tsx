"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  SHIPPING_PROVIDER_IDS,
  type FixedRateEntry,
  type ShippingProviderId,
  type ShippingSettings,
} from "@luratha/schemas";
// Type-only import — the server-only module is erased at compile time.
import type { MelhorEnvioServiceOption } from "@/src/lib/melhorEnvioServices";
import { previewFreeShippingThreshold } from "@/src/lib/freeShippingPreview";
import styles from "./SettingsForm.module.css";

const PROVIDER_LABELS: Record<ShippingProviderId, string> = {
  "melhor-envio": "Melhor Envio",
  "fixed-rate": "Tabela fixa",
};

const EMPTY_ENTRY: FixedRateEntry = {
  state: "",
  price: 0,
  estimatedDays: 7,
  weightLimitKg: 1,
  additionalKgPrice: 0,
};

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/** NaN (empty input) collapses to 0; the server-side Zod schema rejects invalid values. */
function num(value: number): number {
  return Number.isNaN(value) ? 0 : value;
}

/** Formats a number as Brazilian currency, e.g. 71.43 → "R$ 71,43". */
function brl(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function SettingsForm({
  initialShipping,
  availableServices,
}: {
  initialShipping: ShippingSettings;
  availableServices: MelhorEnvioServiceOption[] | null;
}) {
  const router = useRouter();
  const [shipping, setShipping] = useState<ShippingSettings>(initialShipping);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [simCost, setSimCost] = useState(12);

  function patch(partial: Partial<ShippingSettings>) {
    setShipping((s) => ({ ...s, ...partial }));
    setStatus({ kind: "idle" });
  }
  function patchFreeShipping(partial: Partial<ShippingSettings["freeShipping"]>) {
    patch({ freeShipping: { ...shipping.freeShipping, ...partial } });
  }
  function patchFixedRate(partial: Partial<ShippingSettings["fixedRate"]>) {
    patch({ fixedRate: { ...shipping.fixedRate, ...partial } });
  }

  function toggleCatalogService(option: MelhorEnvioServiceOption, checked: boolean) {
    if (checked) {
      if (shipping.enabledServices.some((s) => s.code === option.code)) return;
      patch({
        enabledServices: [
          ...shipping.enabledServices,
          { code: option.code, label: option.label, enabled: true },
        ],
      });
    } else {
      patch({
        enabledServices: shipping.enabledServices.filter((s) => s.code !== option.code),
      });
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipping }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setStatus({
          kind: "error",
          message: data.message ?? "Não foi possível salvar as configurações.",
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

  const { freeShipping, fixedRate } = shipping;
  const saving = status.kind === "saving";

  // Catalog mode: pick services from the Melhor Envio API instead of typing
  // codes. Falls back to the manual editor for fixed-rate or when the catalog
  // could not be fetched (no token / scope / API down).
  const useCatalog = availableServices !== null && shipping.providerId === "melhor-envio";
  const extraServices = availableServices
    ? shipping.enabledServices.filter((s) => !availableServices.some((o) => o.code === s.code))
    : [];

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {/* ── Provider ──────────────────────────────────────────────── */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Provider de frete</legend>

        <label className={styles.field}>
          <span className={styles.label}>Provider ativo</span>
          <select
            className={styles.input}
            value={shipping.providerId}
            onChange={(e) => patch({ providerId: e.target.value as ShippingProviderId })}
          >
            {SHIPPING_PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {PROVIDER_LABELS[id]}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>CEP de origem</span>
          <input
            className={styles.input}
            value={shipping.originPostalCode}
            placeholder="00000-000"
            onChange={(e) => patch({ originPostalCode: e.target.value })}
          />
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Peso de fallback (kg)</span>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              min="0"
              value={shipping.fallbackProductWeightKg}
              onChange={(e) => patch({ fallbackProductWeightKg: num(e.target.valueAsNumber) })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>TTL do cache (segundos)</span>
            <input
              className={styles.input}
              type="number"
              step="1"
              min="0"
              value={shipping.cacheTtlSeconds}
              onChange={(e) => patch({ cacheTtlSeconds: num(e.target.valueAsNumber) })}
            />
          </label>
        </div>

        <span className={styles.label}>Dimensões de fallback (cm)</span>
        <div className={styles.row}>
          {(["length", "width", "height"] as const).map((dim) => (
            <label key={dim} className={styles.field}>
              <span className={styles.subLabel}>
                {dim === "length" ? "Comprimento" : dim === "width" ? "Largura" : "Altura"}
              </span>
              <input
                className={styles.input}
                type="number"
                step="0.1"
                min="0"
                value={shipping.fallbackProductDimensionsCm[dim]}
                onChange={(e) =>
                  patch({
                    fallbackProductDimensionsCm: {
                      ...shipping.fallbackProductDimensionsCm,
                      [dim]: num(e.target.valueAsNumber),
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
      </fieldset>

      {/* ── Serviços habilitados ─────────────────────────────────────── */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Serviços habilitados</legend>
        <p className={styles.hint}>
          Filtro pós-resposta do provider. Nenhum marcado = todos os serviços passam.
        </p>

        {useCatalog ? (
          <>
            <p className={styles.hint}>
              Catálogo obtido do Melhor Envio — marque os serviços a oferecer.
            </p>
            <ul className={styles.catalogList}>
              {availableServices.map((option) => {
                const checked = shipping.enabledServices.some((s) => s.code === option.code);
                return (
                  <li key={option.code}>
                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleCatalogService(option, e.target.checked)}
                      />
                      <span>
                        {option.label}
                        {option.company && (
                          <span className={styles.company}> · {option.company}</span>
                        )}
                        <span className={styles.code}> (#{option.code})</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {extraServices.length > 0 && (
              <div className={styles.extras}>
                <span className={styles.subLabel}>Serviços salvos fora do catálogo atual</span>
                <div className={styles.extraChips}>
                  {extraServices.map((s) => (
                    <span key={s.code} className={styles.extraChip}>
                      {s.label} (#{s.code})
                      <button
                        type="button"
                        className={styles.chipRemove}
                        aria-label={`Remover ${s.label}`}
                        onClick={() =>
                          patch({
                            enabledServices: shipping.enabledServices.filter(
                              (e) => e.code !== s.code,
                            ),
                          })
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {shipping.providerId === "melhor-envio" && (
              <p className={styles.hint}>
                Catálogo do Melhor Envio indisponível (token sem o escopo
                <code> shipping-services</code> ou API fora do ar). Edite os serviços manualmente.
              </p>
            )}
            {shipping.enabledServices.map((service, index) => (
              <div key={index} className={styles.row}>
                <label className={styles.field}>
                  <span className={styles.subLabel}>Código</span>
                  <input
                    className={styles.input}
                    value={service.code}
                    onChange={(e) => {
                      const next = [...shipping.enabledServices];
                      next[index] = { ...service, code: e.target.value };
                      patch({ enabledServices: next });
                    }}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.subLabel}>Nome</span>
                  <input
                    className={styles.input}
                    value={service.label}
                    onChange={(e) => {
                      const next = [...shipping.enabledServices];
                      next[index] = { ...service, label: e.target.value };
                      patch({ enabledServices: next });
                    }}
                  />
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={service.enabled}
                    onChange={(e) => {
                      const next = [...shipping.enabledServices];
                      next[index] = { ...service, enabled: e.target.checked };
                      patch({ enabledServices: next });
                    }}
                  />
                  <span>Ativo</span>
                </label>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() =>
                    patch({
                      enabledServices: shipping.enabledServices.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.addButton}
              onClick={() =>
                patch({
                  enabledServices: [
                    ...shipping.enabledServices,
                    { code: "", label: "", enabled: true },
                  ],
                })
              }
            >
              + Adicionar serviço
            </button>
          </>
        )}
      </fieldset>

      {/* ── Frete grátis ─────────────────────────────────────────────── */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Frete grátis</legend>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={freeShipping.enabled}
            onChange={(e) => patchFreeShipping({ enabled: e.target.checked })}
          />
          <span>Regra de frete grátis ativa</span>
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Divisor da fórmula</span>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={freeShipping.divisor}
              onChange={(e) => patchFreeShipping({ divisor: num(e.target.valueAsNumber) })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Threshold mínimo (R$)</span>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              min="0"
              value={freeShipping.minThreshold}
              onChange={(e) => patchFreeShipping({ minThreshold: num(e.target.valueAsNumber) })}
            />
          </label>
        </div>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={freeShipping.maxThreshold === null}
            onChange={(e) => patchFreeShipping({ maxThreshold: e.target.checked ? null : 0 })}
          />
          <span>Sem teto de threshold</span>
        </label>
        {freeShipping.maxThreshold !== null && (
          <label className={styles.field}>
            <span className={styles.label}>Threshold máximo (R$)</span>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              min="0"
              value={freeShipping.maxThreshold}
              onChange={(e) => patchFreeShipping({ maxThreshold: num(e.target.valueAsNumber) })}
            />
          </label>
        )}

        {/* Formula explainer + live simulator. */}
        <div className={styles.formula}>
          <p className={styles.formulaTitle}>Como o limite é calculado</p>
          <p className={styles.formulaText}>
            Para cada CEP, o sistema cota o frete de um pacote de 1&nbsp;kg e aplica:
          </p>
          <p className={styles.formulaExpr}>limite = custo do frete (1&nbsp;kg) ÷ divisor</p>
          <p className={styles.formulaText}>
            O resultado nunca fica abaixo do <strong>threshold mínimo</strong>. Se ultrapassar o{" "}
            <strong>threshold máximo</strong>, o frete grátis não é oferecido naquela região (frete
            caro demais para a loja absorver). Divisor maior ⇒ limite menor ⇒ mais clientes ganham
            frete grátis.
          </p>

          <div className={styles.simulator}>
            <label className={styles.field}>
              <span className={styles.subLabel}>Simular: custo de frete 1&nbsp;kg (R$)</span>
              <input
                className={styles.input}
                type="number"
                step="0.01"
                min="0"
                value={simCost}
                onChange={(e) => setSimCost(num(e.target.valueAsNumber))}
              />
            </label>
            <p className={styles.simResult}>
              <FreeShippingPreviewText cost={simCost} config={freeShipping} />
            </p>
          </div>
        </div>
      </fieldset>

      {/* ── Tabela fixa ──────────────────────────────────────────────── */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>Tabela fixa</legend>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Transportadora</span>
            <input
              className={styles.input}
              value={fixedRate.carrier}
              onChange={(e) => patchFixedRate({ carrier: e.target.value })}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Serviço</span>
            <input
              className={styles.input}
              value={fixedRate.service}
              onChange={(e) => patchFixedRate({ service: e.target.value })}
            />
          </label>
        </div>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={fixedRate.enabledAsFallback}
            onChange={(e) => patchFixedRate({ enabledAsFallback: e.target.checked })}
          />
          <span>Usar como fallback quando o provider primário falha</span>
        </label>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={fixedRate.defaultEntry !== null}
            onChange={(e) =>
              patchFixedRate({
                defaultEntry: e.target.checked ? { ...EMPTY_ENTRY } : null,
              })
            }
          />
          <span>Definir entrada padrão (UFs fora da tabela)</span>
        </label>
        {fixedRate.defaultEntry !== null && (
          <EntryFields
            entry={fixedRate.defaultEntry}
            onChange={(entry) => patchFixedRate({ defaultEntry: entry })}
          />
        )}

        <span className={styles.label}>Tabela por UF</span>
        {fixedRate.entries.map((entry, index) => (
          <div key={index} className={styles.entryRow}>
            <EntryFields
              entry={entry}
              onChange={(next) => {
                const entries = [...fixedRate.entries];
                entries[index] = next;
                patchFixedRate({ entries });
              }}
            />
            <button
              type="button"
              className={styles.removeButton}
              onClick={() =>
                patchFixedRate({
                  entries: fixedRate.entries.filter((_, i) => i !== index),
                })
              }
            >
              Remover
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addButton}
          onClick={() =>
            patchFixedRate({
              entries: [...fixedRate.entries, { ...EMPTY_ENTRY }],
            })
          }
        >
          + Adicionar UF
        </button>
      </fieldset>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={saving}>
          {saving ? "Salvando…" : "Salvar configurações"}
        </button>
        {status.kind === "saved" && (
          <span role="status" className={styles.ok}>
            Configurações salvas.
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

function FreeShippingPreviewText({
  cost,
  config,
}: {
  cost: number;
  config: ShippingSettings["freeShipping"];
}) {
  const preview = previewFreeShippingThreshold(cost, config);
  switch (preview.kind) {
    case "disabled":
      return <>Regra de frete grátis desativada.</>;
    case "invalid":
      return <>Informe um custo de frete válido para simular.</>;
    case "over-cap":
      return (
        <>
          Acima do teto de {brl(config.maxThreshold ?? 0)} — frete grátis não seria oferecido nesta
          região.
        </>
      );
    case "threshold":
      return (
        <>
          Frete grátis a partir de <strong>{brl(preview.value)}</strong> de subtotal.
          {preview.flooredByMin && " (piso mínimo aplicado)"}
        </>
      );
  }
}

function EntryFields({
  entry,
  onChange,
}: {
  entry: FixedRateEntry;
  onChange: (entry: FixedRateEntry) => void;
}) {
  return (
    <div className={styles.entryGrid}>
      <label className={styles.field}>
        <span className={styles.subLabel}>UF</span>
        <input
          className={styles.input}
          value={entry.state}
          maxLength={2}
          onChange={(e) => onChange({ ...entry, state: e.target.value.toUpperCase() })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.subLabel}>Preço (R$)</span>
        <input
          className={styles.input}
          type="number"
          step="0.01"
          min="0"
          value={entry.price}
          onChange={(e) => onChange({ ...entry, price: num(e.target.valueAsNumber) })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.subLabel}>Prazo (dias)</span>
        <input
          className={styles.input}
          type="number"
          step="1"
          min="1"
          value={entry.estimatedDays}
          onChange={(e) => onChange({ ...entry, estimatedDays: num(e.target.valueAsNumber) })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.subLabel}>Limite de peso (kg)</span>
        <input
          className={styles.input}
          type="number"
          step="0.1"
          min="0"
          value={entry.weightLimitKg}
          onChange={(e) => onChange({ ...entry, weightLimitKg: num(e.target.valueAsNumber) })}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.subLabel}>R$/kg adicional</span>
        <input
          className={styles.input}
          type="number"
          step="0.01"
          min="0"
          value={entry.additionalKgPrice}
          onChange={(e) => onChange({ ...entry, additionalKgPrice: num(e.target.valueAsNumber) })}
        />
      </label>
    </div>
  );
}
