"use client";

import { useState } from "react";
import styles from "./PaymentResult.module.css";

export type PaymentMethod = "pix" | "credit_card" | "boleto";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "in_dispute"
  | "failed"
  | "refunded"
  | "charged_back";

export interface PaymentResultData {
  paymentId: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  statusDetail?: string;
  pix?: {
    qrCode: string;
    qrCodeBase64: string;
    ticketUrl?: string;
    expiresAt?: string;
  };
  boleto?: {
    url: string;
    barcode?: string;
    digitableLine?: string;
  };
}

export interface PaymentResultProps {
  result: PaymentResultData;
  onTryAgain?: () => void;
}

const STATUS_COPY: Record<PaymentStatus, { label: string; tone: "ok" | "warn" | "error" }> = {
  paid: { label: "Pagamento aprovado", tone: "ok" },
  authorized: { label: "Pagamento autorizado", tone: "ok" },
  pending: { label: "Aguardando pagamento", tone: "warn" },
  failed: { label: "Pagamento recusado", tone: "error" },
  in_dispute: { label: "Em contestação", tone: "warn" },
  refunded: { label: "Reembolsado", tone: "warn" },
  charged_back: { label: "Estornado", tone: "error" },
};

export default function PaymentResult({ result, onTryAgain }: PaymentResultProps) {
  const [copied, setCopied] = useState(false);
  const copy = STATUS_COPY[result.status];

  async function copyPixCode() {
    if (!result.pix) return;
    await navigator.clipboard.writeText(result.pix.qrCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <section className={styles.section} aria-live="polite">
      <header className={styles.header}>
        <span className={styles.badge} data-tone={copy.tone}>
          {copy.label}
        </span>
        {/* statusDetail do MP (ex.: "pending_waiting_transfer") é jargão
            técnico; mantemos no tipo pra logs/debug mas não exibimos. */}
      </header>

      {result.paymentMethod === "pix" && result.pix && (
        <div className={styles.pixBlock}>
          {/* next/image não otimiza data: URLs (PIX QR vem em base64 da MP), então usamos <img> nativo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${result.pix.qrCodeBase64}`}
            alt="QR Code para pagamento PIX"
            className={styles.qr}
          />
          <p className={styles.pixHelp}>
            Abra o app do seu banco, escolha pagar com PIX, escaneie o QR Code
            ou cole o código abaixo.
          </p>
          <div className={styles.copyBlock}>
            <code className={styles.copyText}>{result.pix.qrCode}</code>
            <button type="button" className={styles.copyBtn} onClick={copyPixCode}>
              {copied ? "Copiado!" : "Copiar código"}
            </button>
          </div>
          {result.pix.expiresAt && (
            <p className={styles.muted}>
              Válido até{" "}
              {new Date(result.pix.expiresAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
              .
            </p>
          )}
        </div>
      )}

      {result.paymentMethod === "boleto" && result.boleto && (
        <div className={styles.boletoBlock}>
          <p className={styles.boletoHelp}>
            Seu boleto foi gerado. Você pode pagar em qualquer banco ou
            internet banking.
          </p>
          <a
            href={result.boleto.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.boletoBtn}
          >
            Abrir boleto em PDF
          </a>
          {result.boleto.digitableLine && (
            <div className={styles.copyBlock}>
              <code className={styles.copyText}>{result.boleto.digitableLine}</code>
            </div>
          )}
        </div>
      )}

      {result.paymentMethod === "credit_card" && copy.tone === "error" && onTryAgain && (
        <button type="button" className={styles.retryBtn} onClick={onTryAgain}>
          Tentar outro método
        </button>
      )}
    </section>
  );
}
