"use client";

import { useState, type FormEvent } from "react";
import { ApiResponseError } from "@/src/lib/errors";
import type { AppliedCoupon } from "./OrderSummary";
import styles from "./CouponField.module.css";

export interface CouponFieldProps {
  cartTotal: number;
  /** Cupom já aplicado (estado controlado pelo pai). */
  applied?: AppliedCoupon | null;
  /** Chamado quando o backend confirma valid:true. */
  onApplied: (coupon: AppliedCoupon) => void;
  /** Chamado quando o usuário remove um cupom já aplicado. */
  onCleared: () => void;
}

type ValidateResponse =
  | { valid: true; code: string; type: AppliedCoupon["type"]; discount: number }
  | { valid: false; reason: string };

export default function CouponField({
  cartTotal,
  applied = null,
  onApplied,
  onCleared,
}: CouponFieldProps) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), cartTotal }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new ApiResponseError(
          body.message ?? "Não foi possível validar o cupom.",
          res.status,
        );
      }
      const data = (await res.json()) as ValidateResponse;
      if (data.valid) {
        onApplied({ code: data.code, discount: data.discount, type: data.type });
        setCode("");
      } else {
        setError(data.reason);
      }
    } catch (err) {
      if (err instanceof ApiResponseError) {
        setError(err.message);
      } else {
        throw err;
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleRemove() {
    onCleared();
    setError(null);
    setCode("");
  }

  if (applied) {
    return (
      <div className={styles.applied} role="status">
        <div>
          <p className={styles.appliedLabel}>Cupom aplicado</p>
          <p className={styles.appliedCode}>{applied.code}</p>
        </div>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={handleRemove}
          aria-label={`Remover cupom ${applied.code}`}
        >
          Remover
        </button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label htmlFor="coupon-code" className={styles.label}>
        Tem um cupom?
      </label>
      <div className={styles.inputRow}>
        <input
          id="coupon-code"
          className={styles.input}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="CUPOM10"
          autoComplete="off"
          disabled={submitting}
        />
        <button
          type="submit"
          className={styles.submitBtn}
          disabled={!code.trim() || submitting}
        >
          {submitting ? "Validando…" : "Aplicar"}
        </button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
