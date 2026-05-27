"use client";

import type { ReactNode } from "react";
import type { Address } from "@luratha/schemas";
import { formatCnpj } from "@/src/lib/format/cnpj";
import { formatCpf } from "@/src/lib/format/cpf";
import type { PaymentPayer } from "./PaymentStep";
import type { ShippingQuote } from "./ShippingStep";
import styles from "./ReviewSummary.module.css";

/**
 * Cards de revisão do Step "Revisão" (4 de 5). Mostra o que o usuário escolheu
 * nos steps anteriores (dados pessoais, endereço, frete) com botão "Editar"
 * em cada bloco que volta pro step correspondente. Apresentação pura — não
 * conhece API nem dispatch. O método de pagamento é escolhido no step
 * seguinte (Pagamento).
 */
export interface ReviewSummaryProps {
  payer: PaymentPayer;
  address: Address;
  quote: ShippingQuote;
  onEditPayer: () => void;
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

function formatIdentification(payer: PaymentPayer): string {
  const { type, number } = payer.identification;
  return type === "CPF" ? `CPF ${formatCpf(number)}` : `CNPJ ${formatCnpj(number)}`;
}

function fullName(payer: PaymentPayer): string {
  return [payer.firstName, payer.lastName].filter(Boolean).join(" ").trim();
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
  payer,
  address,
  quote,
  onEditPayer,
  onEditAddress,
  onEditShipping,
}: ReviewSummaryProps) {
  const name = fullName(payer);
  return (
    <div className={styles.wrapper}>
      <ReviewCard title="Seus dados" onEdit={onEditPayer}>
        {name && (
          <p className={styles.line}>
            <strong>{name}</strong>
          </p>
        )}
        <p className={styles.line}>{payer.email}</p>
        <p className={styles.line}>{formatIdentification(payer)}</p>
      </ReviewCard>

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
