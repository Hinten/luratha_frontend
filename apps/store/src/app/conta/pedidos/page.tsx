"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Order } from "@luratha/schemas";
import OrderListItem from "@/src/components/conta/OrderListItem";
import styles from "./page.module.css";

export default function PedidosListPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const uid = user.uid;
      const res = await fetch(`/api/orders?userId=${uid}&limit=100`);
      if (cancelled) return;
      if (res.ok) {
        setOrders((await res.json()) as Order[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Meus pedidos</h2>

      {loading ? (
        <p className={styles.muted}>Carregando…</p>
      ) : orders.length === 0 ? (
        <p className={styles.muted}>Você ainda não fez nenhum pedido.</p>
      ) : (
        <div className={styles.list}>
          {orders.map((order) => (
            <OrderListItem key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
