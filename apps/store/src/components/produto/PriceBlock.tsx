import styles from "./PriceBlock.module.css";

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );

interface PriceBlockProps {
  price: number;
  originalPrice?: number;
  installments?: { count: number; value: number };
}

export default function PriceBlock({
  price,
  originalPrice,
  installments,
}: PriceBlockProps) {
  const discountPct =
    originalPrice !== undefined
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  return (
    <div className={styles.wrapper}>
      {discountPct > 0 && (
        <span className={styles.badge}>{discountPct}% OFF</span>
      )}
      {originalPrice !== undefined && (
        <span className={styles.original}>{formatBRL(originalPrice)}</span>
      )}
      <span className={styles.current}>{formatBRL(price)}</span>
      {installments && (
        <span className={styles.installments}>
          até {installments.count}x de {formatBRL(installments.value)} sem juros
        </span>
      )}
    </div>
  );
}
