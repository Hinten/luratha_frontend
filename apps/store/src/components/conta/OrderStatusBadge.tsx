import type { Order } from "@luratha/schemas";
import { getOrderDisplayStatus } from "@/src/lib/orders/orderDisplayStatus";
import styles from "./OrderStatusBadge.module.css";

/**
 * Badge de status do pedido. Compõe a label a partir de `status` + `paymentStatus`
 * via `getOrderDisplayStatus` (issue #121) — um pedido em contestação não aparece
 * mais como "Pago".
 */
export default function OrderStatusBadge({
  order,
}: {
  order: Pick<Order, "status" | "paymentStatus">;
}) {
  const { label, variant } = getOrderDisplayStatus(order);
  return <span className={`${styles.badge} ${styles[variant]}`}>{label}</span>;
}
