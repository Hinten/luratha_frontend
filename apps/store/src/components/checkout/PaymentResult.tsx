"use client";

import styles from "./PaymentResult.module.css";
import PixDisplay from "./PixDisplay";
import BoletoDisplay from "./BoletoDisplay";

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

/** Ícone de ampulheta — usado no bloco de cartão em análise. */
function HourglassIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 2h12" />
      <path d="M6 22h12" />
      <path d="M6 2v4a6 6 0 0 0 6 6 6 6 0 0 1 6 6v4" />
      <path d="M18 2v4a6 6 0 0 1-6 6 6 6 0 0 0-6 6v4" />
    </svg>
  );
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
  const copy = STATUS_COPY[result.status];

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
        <PixDisplay
          qrCode={result.pix.qrCode}
          qrCodeBase64={result.pix.qrCodeBase64}
          expiresAt={result.pix.expiresAt}
        />
      )}

      {result.paymentMethod === "boleto" && result.boleto && (
        <BoletoDisplay
          url={result.boleto.url}
          digitableLine={result.boleto.digitableLine}
          barcode={result.boleto.barcode}
        />
      )}

      {result.paymentMethod === "credit_card" && result.status === "pending" && (
        <div className={styles.pendingBlock}>
          <HourglassIcon className={styles.pendingIcon} />
          <h3 className={styles.pendingTitle}>Seu pagamento está em análise</h3>
          <p className={styles.pendingDescription}>
            Recebemos seu pagamento e a operadora do cartão está validando a
            transação. Isso costuma levar alguns minutos, mas em alguns casos
            pode demorar até <strong>2 dias úteis</strong>.
          </p>
          <p className={styles.pendingDescription}>
            Você receberá um e-mail assim que a aprovação for confirmada — não
            é preciso fazer nada agora. Você também pode acompanhar o status
            na sua conta a qualquer momento.
          </p>
        </div>
      )}

      {result.paymentMethod === "credit_card" && copy.tone === "error" && (
        <div className={styles.failedBlock}>
          <p className={styles.failedDescription}>
            Não foi possível processar seu cartão. Verifique os dados ou tente
            outra forma de pagamento — você não foi cobrado.
          </p>
          {onTryAgain && (
            <button type="button" className={styles.retryBtn} onClick={onTryAgain}>
              Tentar outro método
            </button>
          )}
        </div>
      )}
    </section>
  );
}
