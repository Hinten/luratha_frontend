"use client";

import { useEffect, useState } from "react";
import { TERMINAL_PAYMENT_STATUSES, type PaymentStatus } from "@luratha/schemas";
import styles from "./PaymentResult.module.css";

export type PaymentMethod = "pix" | "credit_card" | "boleto";

// `PaymentStatus` é a fonte única em `@luratha/schemas` — re-exportado aqui pra
// quem importa do componente não precisar conhecer o pacote de schemas.
export type { PaymentStatus };

export interface PixArtifact {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl?: string;
  expiresAt?: string;
}

export interface BoletoArtifact {
  url: string;
  barcode?: string;
  digitableLine?: string;
}

export interface PaymentResultData {
  paymentId: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  statusDetail?: string;
  pix?: PixArtifact;
  /** PIX criado mas o QR ainda não foi gerado pelo MP — client deve pollar. */
  pixPending?: boolean;
  boleto?: BoletoArtifact;
  /** Boleto criado mas os dados ainda não foram gerados — client deve pollar. */
  boletoPending?: boolean;
  /** Pagamento em análise antifraude no MP — UI mostra "em análise" em vez de "gerando…". */
  underReview?: boolean;
}

export interface PaymentResultProps {
  result: PaymentResultData;
  /** Id do pedido (`Order.id`) — usado no polling do artefato pendente. */
  orderId: string;
  onTryAgain?: () => void;
}

/** Intervalo e teto do polling do artefato (QR do PIX / boleto) ainda não gerado. */
export const PAYMENT_POLL_INTERVAL_MS = 15_000;
export const PAYMENT_POLL_TIMEOUT_MS = 120_000;

interface OrderArtifactsResponse {
  status?: PaymentStatus;
  pix?: PixArtifact;
  boleto?: BoletoArtifact;
  underReview?: boolean;
}

/** Ícone de ampulheta — usado no bloco de cartão em análise e no "gerando…". */
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

/**
 * Status em que o pagamento não vai avançar sozinho e não há artefato a gerar —
 * o polling deve parar (em vez de tentar por 2min) e a UI mostra a mensagem
 * certa. `paid` é tratado à parte (redireciona pra página de sucesso). Fonte
 * única em `@luratha/schemas` (`TERMINAL_PAYMENT_STATUSES`).
 */
const TERMINAL_FAILURE_STATUSES = new Set<PaymentStatus>(TERMINAL_PAYMENT_STATUSES);

const STATUS_COPY: Record<PaymentStatus, { label: string; tone: "ok" | "warn" | "error" }> = {
  paid: { label: "Pagamento aprovado", tone: "ok" },
  authorized: { label: "Pagamento autorizado", tone: "ok" },
  pending: { label: "Aguardando pagamento", tone: "warn" },
  awaiting_pix: { label: "Aguardando pagamento", tone: "warn" },
  awaiting_boleto: { label: "Aguardando pagamento", tone: "warn" },
  partially_refunded: { label: "Reembolsado parcialmente", tone: "warn" },
  failed: { label: "Falha no pagamento", tone: "error" },
  cancelled: { label: "Pagamento cancelado", tone: "error" },
  rejected: { label: "Pagamento recusado", tone: "error" },
  in_dispute: { label: "Em contestação", tone: "warn" },
  refunded: { label: "Reembolsado", tone: "warn" },
  charged_back: { label: "Estornado", tone: "error" },
  unknown: { label: "Em análise pela equipe técnica", tone: "warn" },
};

export default function PaymentResult({ result, orderId, onTryAgain }: PaymentResultProps) {
  const [copied, setCopied] = useState(false);
  // Artefato obtido via polling quando a criação veio sem ele.
  const [polled, setPolled] = useState<OrderArtifactsResponse | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  // Status mais recente: o que o polling descobriu (ex.: o pagamento foi recusado
  // ou caiu em `unknown` enquanto gerávamos o artefato) ou, antes do 1º poll, o
  // da criação. Direciona o badge e a detecção de falha terminal.
  const effectiveStatus = polled?.status ?? result.status;
  const copy = STATUS_COPY[effectiveStatus];

  const pix = result.pix ?? polled?.pix;
  const boleto = result.boleto ?? polled?.boleto;
  const awaitingPix = result.paymentMethod === "pix" && Boolean(result.pixPending) && !pix;
  const awaitingBoleto =
    result.paymentMethod === "boleto" && Boolean(result.boletoPending) && !boleto;
  // O artefato não vai chegar: o pagamento atingiu um status terminal de falha
  // (recusa, estorno, ou `unknown` fail-safe) durante a janela de geração.
  const artifactFailed =
    (awaitingPix || awaitingBoleto) && TERMINAL_FAILURE_STATUSES.has(effectiveStatus);
  // Em análise antifraude? Usa o dado mais recente do polling; antes do 1º poll,
  // o valor da criação. Decide entre "pagamento em análise" e "gerando…".
  const underReview = polled ? Boolean(polled.underReview) : Boolean(result.underReview);

  // Polling do artefato pendente: relê a order no MP a cada 15s até ele chegar
  // (ou desistir após ~2min). A criação não recria nada — só consulta. Contamos
  // tentativas (em vez de relógio) pra ser determinístico — teto = 2min/15s.
  useEffect(() => {
    if (!awaitingPix && !awaitingBoleto) return;
    if (pollTimedOut) return;

    const maxAttempts = Math.max(1, Math.floor(PAYMENT_POLL_TIMEOUT_MS / PAYMENT_POLL_INTERVAL_MS));
    let attempts = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      if (cancelled) return;
      if (attempts >= maxAttempts) {
        setPollTimedOut(true);
        return;
      }
      timer = setTimeout(runPoll, PAYMENT_POLL_INTERVAL_MS);
    };

    const runPoll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await fetch(
          `/api/checkout/payment-intent?orderId=${encodeURIComponent(orderId)}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          // Erro transitório do servidor/MP — tenta de novo até o deadline.
          scheduleNext();
          return;
        }
        const data = (await res.json()) as OrderArtifactsResponse;
        if (cancelled) return;
        if (data.status === "paid") {
          window.location.assign(`/checkout/sucesso/${orderId}`);
          return;
        }
        // Guarda o snapshot mais recente (status/underReview) mesmo sem artefato,
        // pra UI refletir "em análise" enquanto polla.
        setPolled(data);
        if (data.pix || data.boleto) return; // artefato chegou — para de pollar
        // Falha terminal (recusa/estorno/`unknown`): o artefato não virá e o
        // pedido não avança sozinho — para de pollar e mostra a mensagem certa.
        if (data.status && TERMINAL_FAILURE_STATUSES.has(data.status)) return;
        scheduleNext();
      } catch (err) {
        // Rede instável (TypeError) ou request abortado — segue tentando até o
        // deadline. Qualquer outro erro sobe (sem fallback silencioso).
        if (err instanceof TypeError || (err instanceof DOMException && err.name === "AbortError")) {
          scheduleNext();
          return;
        }
        throw err;
      }
    };

    timer = setTimeout(runPoll, PAYMENT_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [orderId, awaitingPix, awaitingBoleto, pollTimedOut]);

  async function copyPixCode() {
    if (!pix) return;
    await navigator.clipboard.writeText(pix.qrCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  const artifactLabel = result.paymentMethod === "pix" ? "o QR Code do PIX" : "o boleto";

  // Fase do bloco de artefato pendente: falha terminal > timeout do polling >
  // ainda carregando. (`paid` redireciona antes de chegar aqui.)
  const artifactPhase: "failed" | "timeout" | "loading" = artifactFailed
    ? "failed"
    : pollTimedOut
      ? "timeout"
      : "loading";
  const failedArtifactMessage =
    effectiveStatus === "unknown"
      ? "Estamos confirmando seu pagamento. Nossa equipe vai concluir a verificação e avisamos por e-mail — acompanhe também na sua conta."
      : "Não foi possível concluir o pagamento. Você não foi cobrado — atualize a página e tente novamente ou escolha outra forma de pagamento.";

  return (
    <section className={styles.section} aria-live="polite">
      <header className={styles.header}>
        <span className={styles.badge} data-tone={copy.tone}>
          {copy.label}
        </span>
        {/* statusDetail do MP (ex.: "pending_waiting_transfer") é jargão
            técnico; mantemos no tipo pra logs/debug mas não exibimos. */}
      </header>

      {/* Artefato (QR/boleto) ainda não disponível. Três fases:
          (1) `failed` — o pagamento atingiu status terminal de falha durante a
              geração (recusa/estorno/`unknown`); não adianta esperar;
          (2) `timeout` — esgotou os 2min de polling sem o artefato (a mensagem
              difere se está em análise antifraude — refresh não resolve);
          (3) `loading` — ainda gerando ("em análise" se `underReview`). */}
      {(awaitingPix || awaitingBoleto) && artifactPhase === "failed" && (
        <div className={styles.failedBlock} role="alert">
          <p className={styles.failedDescription}>{failedArtifactMessage}</p>
        </div>
      )}
      {(awaitingPix || awaitingBoleto) && artifactPhase === "timeout" && (
        <div className={styles.failedBlock} role="alert">
          <p className={styles.failedDescription}>
            {underReview
              ? "Seu pagamento segue em análise. Avisaremos por e-mail quando concluir — você pode acompanhar na sua conta."
              : `Não conseguimos gerar ${artifactLabel} a tempo. Atualize a página e tente novamente — você não foi cobrado.`}
          </p>
        </div>
      )}
      {(awaitingPix || awaitingBoleto) && artifactPhase === "loading" && (
        <div className={styles.pendingBlock}>
          <HourglassIcon className={styles.pendingIcon} />
          {underReview ? (
            <>
              <h3 className={styles.pendingTitle}>Pagamento em análise</h3>
              <p className={styles.pendingDescription}>
                Estamos confirmando a segurança do seu pagamento. Assim que for
                aprovado, {artifactLabel} aparece aqui. Mantenha esta página aberta.
              </p>
            </>
          ) : (
            <>
              <h3 className={styles.pendingTitle}>Gerando {artifactLabel}…</h3>
              <p className={styles.pendingDescription}>
                Isso costuma levar alguns segundos. Mantenha esta página aberta.
              </p>
            </>
          )}
        </div>
      )}

      {result.paymentMethod === "pix" && pix && (
        <div className={styles.pixBlock}>
          {/* next/image não otimiza data: URLs (PIX QR vem em base64 da MP), então usamos <img> nativo. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${pix.qrCodeBase64}`}
            alt="QR Code para pagamento PIX"
            className={styles.qr}
          />
          <p className={styles.pixHelp}>
            Abra o app do seu banco, escolha pagar com PIX, escaneie o QR Code
            ou cole o código abaixo.
          </p>
          <div className={styles.copyBlock}>
            <code className={styles.copyText}>{pix.qrCode}</code>
            <button type="button" className={styles.copyBtn} onClick={copyPixCode}>
              {copied ? "Copiado!" : "Copiar código"}
            </button>
          </div>
          {pix.expiresAt && (
            <p className={styles.muted}>
              Válido até{" "}
              {new Date(pix.expiresAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
              .
            </p>
          )}
        </div>
      )}

      {result.paymentMethod === "boleto" && boleto && (
        <div className={styles.boletoBlock}>
          <p className={styles.boletoHelp}>
            Seu boleto foi gerado. Você pode pagar em qualquer banco ou
            internet banking.
          </p>
          <a
            href={boleto.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.boletoBtn}
          >
            Abrir boleto em PDF
          </a>
          {boleto.digitableLine && (
            <div className={styles.copyBlock}>
              <code className={styles.copyText}>{boleto.digitableLine}</code>
            </div>
          )}
        </div>
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
