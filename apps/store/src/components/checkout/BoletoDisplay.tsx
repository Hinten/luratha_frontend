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
 * Bloco de pagamento por boleto: botão para abrir o PDF + linha digitável.
 *
 * Reusado pela tela de sucesso do checkout (`PaymentResult`) e pela página do
 * pedido (`/conta/pedidos/{id}`), onde o cliente reabre o boleto de um
 * pagamento ainda pendente.
 */
export default function BoletoDisplay({ url, digitableLine }: BoletoDisplayProps) {
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
        </div>
      )}
    </div>
  );
}
