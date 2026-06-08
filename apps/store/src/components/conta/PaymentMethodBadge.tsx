import type { Order } from "@luratha/schemas";
import styles from "./PaymentMethodBadge.module.css";

const labels: Record<Order["paymentMethod"], string> = {
  pix: "PIX",
  credit_card: "Cartão de crédito",
  boleto: "Boleto bancário",
};

const variants: Record<Order["paymentMethod"], string> = {
  pix: styles.pix,
  credit_card: styles.card,
  boleto: styles.boleto,
};

export default function PaymentMethodBadge({ method }: { method: Order["paymentMethod"] }) {
  return <span className={`${styles.badge} ${variants[method]}`}>{labels[method]}</span>;
}
