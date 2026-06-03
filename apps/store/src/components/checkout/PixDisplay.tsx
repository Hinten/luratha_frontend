"use client";

import { useState } from "react";
import CopyIcon from "@/src/components/icons/CopyIcon";
import CheckIcon from "@/src/components/icons/CheckIcon";
import styles from "./PixDisplay.module.css";

export interface PixDisplayProps {
  /** Copia-cola (EMV) do PIX. */
  qrCode: string;
  /** Imagem PNG do QR em base64 (sem o prefixo `data:`). */
  qrCodeBase64: string;
  /** ISO-8601 do vencimento, quando conhecido — habilita a linha "Válido até". */
  expiresAt?: string;
}

/**
 * Bloco de pagamento PIX: QR Code + copia-cola.
 *
 * Reusado pela tela de sucesso do checkout (`PaymentResult`) e pela página do
 * pedido (`/conta/pedidos/{id}`), onde o cliente reabre o QR de um pagamento
 * ainda pendente. Props desacopladas de `Order`/`PaymentResultData` de
 * propósito, para servir aos dois lados sem acoplar tipos.
 */
export default function PixDisplay({ qrCode, qrCodeBase64, expiresAt }: PixDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyPixCode() {
    if (!navigator.clipboard) {
      // Clipboard API ausente (contexto não-seguro / navegador antigo):
      // orientamos a cópia manual — o copia-cola já está visível na tela.
      setCopyFailed(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(qrCode);
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
    <div className={styles.pixBlock}>
      {/* next/image não otimiza data: URLs (PIX QR vem em base64 da MP), então usamos <img> nativo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/png;base64,${qrCodeBase64}`}
        alt="QR Code para pagamento PIX"
        className={styles.qr}
      />
      <p className={styles.pixHelp}>
        Abra o app do seu banco, escolha pagar com PIX, escaneie o QR Code
        ou cole o código abaixo.
      </p>
      <div className={styles.copyBlock}>
        <code className={styles.copyText}>{qrCode}</code>
        <button type="button" className={styles.copyBtn} onClick={copyPixCode}>
          {copied ? (
            <CheckIcon className={styles.copyIcon} />
          ) : (
            <CopyIcon className={styles.copyIcon} />
          )}
          {copied ? "Copiado!" : "Copiar código"}
        </button>
        {copyFailed && (
          <p className={styles.copyError} role="alert">
            Não foi possível copiar automaticamente. Selecione o código acima e
            copie manualmente.
          </p>
        )}
      </div>
      {expiresAt && (
        <p className={styles.muted}>
          Válido até{" "}
          {new Date(expiresAt).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
          .
        </p>
      )}
    </div>
  );
}
