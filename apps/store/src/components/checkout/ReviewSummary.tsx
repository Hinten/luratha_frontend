"use client";

import type { ReactNode } from "react";
import type { Address } from "@luratha/schemas";
import type { ShippingQuote } from "./ShippingStep";
import type { PaymentSubmitPayload } from "./PaymentStep";
import styles from "./ReviewSummary.module.css";

/**
 * Cards de revisão do Step 4 (Revisão). Lê o `state` do CheckoutFlow e
 * resume o que o usuário escolheu nos steps anteriores, com botão "Editar"
 * em cada bloco que volta pro step correspondente. Apresentação pura — não
 * conhece API nem dispatch.
 */
export interface ReviewSummaryProps {
  address: Address;
  quote: ShippingQuote;
  paymentDraft: PaymentSubmitPayload;
  onEditAddress: () => void;
  onEditShipping: () => void;
  onEditPayment: () => void;
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const PAYMENT_METHOD_LABEL: Record<
  PaymentSubmitPayload["paymentMethod"],
  string
> = {
  pix: "PIX",
  credit_card: "Cartão de crédito",
  boleto: "Boleto bancário",
};

/** Mascara os 4 últimos dígitos: 12345678901 → 123.456.***-** */
function maskIdentification(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.***-**`;
  }
  if (clean.length === 14) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/****-**`;
  }
  return clean;
}

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
  paymentDraft,
  onEditAddress,
  onEditShipping,
  onEditPayment,
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

      <ReviewCard title="Pagamento" onEdit={onEditPayment}>
        <p className={styles.line}>
          <strong>{PAYMENT_METHOD_LABEL[paymentDraft.paymentMethod]}</strong>
        </p>
        <p className={styles.line}>{paymentDraft.payer.email}</p>
        <p className={styles.line}>
          {paymentDraft.payer.identification.type}:{" "}
          {maskIdentification(paymentDraft.payer.identification.number)}
        </p>
        {paymentDraft.paymentMethod === "credit_card" && (
          <p className={styles.line}>
            {paymentDraft.installments}x ·{" "}
            <span className={styles.brand}>
              {paymentDraft.paymentMethodId}
            </span>
          </p>
        )}
      </ReviewCard>
    </div>
  );
}
