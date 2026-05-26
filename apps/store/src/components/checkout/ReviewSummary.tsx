"use client";

import type { ReactNode } from "react";
import type { Address } from "@luratha/schemas";
import type { ShippingQuote } from "./ShippingStep";
import styles from "./ReviewSummary.module.css";

/**
 * Cards de revisão do Step "Revisão" (3 de 4). Mostra o que o usuário escolheu
 * nos steps anteriores (endereço, frete) com botão "Editar" em cada bloco que
 * volta pro step correspondente. Apresentação pura — não conhece API nem
 * dispatch. O método de pagamento é escolhido no step seguinte (Pagamento).
 */
export interface ReviewSummaryProps {
  address: Address;
  quote: ShippingQuote;
  onEditAddress: () => void;
  onEditShipping: () => void;
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function deliveryText(days: number): string {
  if (days <= 0) return "";
  return `em até ${days} ${days === 1 ? "dia útil" : "dias úteis"}`;
}

function ReviewCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <button
          type="button"
          className={styles.editBtn}
          onClick={onEdit}
          aria-label={`Editar ${title.toLowerCase()}`}
        >
          Editar
        </button>
      </header>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

export default function ReviewSummary({
  address,
  quote,
  onEditAddress,
  onEditShipping,
}: ReviewSummaryProps) {
  return (
    <div className={styles.wrapper}>
      <ReviewCard title="Endereço de entrega" onEdit={onEditAddress}>
        <p className={styles.line}>
          <strong>{address.recipientName}</strong>
        </p>
        <p className={styles.line}>
          {address.line1}, {address.number}
          {address.complement ? ` — ${address.complement}` : ""}
        </p>
        <p className={styles.line}>
          {address.neighborhood} · {address.city}/{address.state} · CEP{" "}
          {address.postalCode}
        </p>
      </ReviewCard>

      <ReviewCard title="Frete" onEdit={onEditShipping}>
        <p className={styles.line}>
          <strong>{quote.carrier}</strong> · {quote.service}
        </p>
        {deliveryText(quote.estimatedDays) && (
          <p className={styles.line}>{deliveryText(quote.estimatedDays)}</p>
        )}
        <p className={styles.linePrice}>
          {quote.freeShippingApplied ? (
            <span className={styles.free}>Grátis</span>
          ) : (
            brl.format(quote.price)
          )}
        </p>
      </ReviewCard>
    </div>
  );
}
