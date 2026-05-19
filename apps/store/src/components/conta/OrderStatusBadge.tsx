import type { Order } from "@luratha/schemas";
import styles from "./OrderStatusBadge.module.css";

const labels: Record<Order["status"], string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  processing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

const variants: Record<Order["status"], string> = {
  pending_payment: styles.warning,
  paid: styles.info,
  processing: styles.info,
  shipped: styles.info,
  delivered: styles.success,
  cancelled: styles.muted,
  refunded: styles.muted,
};

export default function OrderStatusBadge({ status }: { status: Order["status"] }) {
  return <span className={`${styles.badge} ${variants[status]}`}>{labels[status]}</span>;
}
