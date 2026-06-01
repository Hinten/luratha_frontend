"use client";

import { useState } from "react";
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

  async function copyPixCode() {
    await navigator.clipboard.writeText(qrCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
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
          {copied ? "Copiado!" : "Copiar código"}
        </button>
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
