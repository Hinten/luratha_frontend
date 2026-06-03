"use client";

import { useState } from "react";
import CopyIcon from "@/src/components/icons/CopyIcon";
import CheckIcon from "@/src/components/icons/CheckIcon";
import styles from "./BoletoDisplay.module.css";

export interface BoletoDisplayProps {
  /** URL do boleto em PDF (hospedado pelo MercadoPago). */
  url: string;
  /** Linha digitável para pagamento manual. */
  digitableLine?: string;
  /** Código de barras (FEBRABAN) — reservado; hoje não exibido. */
  barcode?: string;
}

/**
 * Bloco de pagamento por boleto: botão para abrir o PDF + linha digitável com
 * botão de copiar (facilita o pagamento manual no app do banco).
 *
 * Reusado pela tela de sucesso do checkout (`PaymentResult`) e pela página do
 * pedido (`/conta/pedidos/{id}`), onde o cliente reabre o boleto de um
 * pagamento ainda pendente.
 */
export default function BoletoDisplay({ url, digitableLine }: BoletoDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyDigitableLine() {
    if (!digitableLine) return;
    if (!navigator.clipboard) {
      // Clipboard API ausente (contexto não-seguro / navegador antigo):
      // orientamos a cópia manual — a linha digitável já está visível na tela.
      setCopyFailed(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(digitableLine);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      if (err instanceof DOMException) {
        // Permissão de clipboard negada — caímos no mesmo aviso de cópia
        // manual. Qualquer outro erro (bug real) continua subindo.
        setCopyFailed(true);
        return;
      }
      throw err;
    }
  }

  return (
    <div className={styles.boletoBlock}>
      <p className={styles.boletoHelp}>
        Seu boleto foi gerado. Você pode pagar em qualquer banco ou
        internet banking.
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.boletoBtn}
      >
        Abrir boleto em PDF
      </a>
      {digitableLine && (
        <div className={styles.copyBlock}>
          <code className={styles.copyText}>{digitableLine}</code>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={copyDigitableLine}
          >
            {copied ? (
              <CheckIcon className={styles.copyIcon} />
            ) : (
              <CopyIcon className={styles.copyIcon} />
            )}
            {copied ? "Copiado!" : "Copiar linha digitável"}
          </button>
          {copyFailed && (
            <p className={styles.copyError} role="alert">
              Não foi possível copiar automaticamente. Selecione o código acima
              e copie manualmente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
