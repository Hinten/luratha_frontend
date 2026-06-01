import Link from "next/link";
import type { Order } from "@luratha/schemas";
import OrderStatusBadge from "./OrderStatusBadge";
import styles from "./OrderListItem.module.css";

export default function OrderListItem({ order }: { order: Order }) {
  const date = new Date(order.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <Link href={`/conta/pedidos/${order.id}`} className={styles.row}>
      <div className={styles.col}>
        <span className={styles.label}>Pedido</span>
        <span className={styles.value}>#{order.orderNumber}</span>
      </div>
      <div className={styles.col}>
        <span className={styles.label}>Data</span>
        <span className={styles.value}>{date}</span>
      </div>
      <div className={styles.col}>
        <span className={styles.label}>Itens</span>
        <span className={styles.value}>{order.itemCount}</span>
      </div>
      <div className={styles.col}>
        <span className={styles.label}>Status</span>
        <OrderStatusBadge order={order} />
      </div>
      <div className={styles.col}>
        <span className={styles.label}>Total</span>
        <span className={styles.value}>
          {order.grandTotal.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </span>
      </div>
    </Link>
  );
}
