"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Address, Order } from "@luratha/schemas";
import OrderStatusBadge from "@/src/components/conta/OrderStatusBadge";
import styles from "./page.module.css";

export default function PedidoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [addressMissing, setAddressMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orderRes = await fetch(`/api/orders/${id}`);
      if (cancelled) return;

      if (!orderRes.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const fetchedOrder = (await orderRes.json()) as Order;
      setOrder(fetchedOrder);

      // Resolve o endereço pelo path armazenado.
      // Path esperado: userProfiles/{uid}/addresses/{addressId}
      const segments = fetchedOrder.shippingAddressPath.split("/");
      if (segments.length === 4) {
        const [, uid, , addressId] = segments;
        const addrRes = await fetch(
          `/api/users/${encodeURIComponent(uid)}/addresses/${addressId}`,
        );
        if (cancelled) return;
        if (addrRes.ok) {
          setAddress((await addrRes.json()) as Address);
        } else {
          setAddressMissing(true);
        }
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p className={styles.muted}>Carregando…</p>;
  if (notFound) {
    return (
      <div className={styles.container}>
        <p className={styles.muted}>Pedido não encontrado.</p>
        <Link href="/conta/pedidos" className={styles.backLink}>← Voltar para meus pedidos</Link>
      </div>
    );
  }
  if (!order) return null;

  const created = new Date(order.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className={styles.container}>
      <Link href="/conta/pedidos" className={styles.backLink}>
        ← Voltar para meus pedidos
      </Link>

      <header className={styles.header}>
        <div>
          <h2 className={styles.heading}>Pedido #{order.orderNumber}</h2>
          <p className={styles.muted}>Realizado em {created}</p>
        </div>
        <OrderStatusBadge order={order} />
      </header>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Itens</h3>
        <ul className={styles.itemList}>
          {order.items.map((item) => (
            <li key={item.id} className={styles.itemRow}>
              <div>
                <p className={styles.itemName}>{item.name}</p>
                <p className={styles.itemMeta}>
                  SKU {item.itemSku}
                  {item.variantId ? ` · variação ${item.variantId}` : ""}
                  {" · "}qtd {item.quantity}
                </p>
              </div>
              <span className={styles.itemTotal}>{formatBRL(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Endereço de entrega</h3>
        {addressMissing ? (
          <p className={styles.muted}>Endereço removido pelo usuário.</p>
        ) : address ? (
          <p className={styles.addressBlock}>
            {address.recipientName}<br />
            {address.line1}, {address.number}
            {address.complement ? ` — ${address.complement}` : ""}<br />
            {address.neighborhood} · {address.city}/{address.state}<br />
            CEP {address.postalCode}
          </p>
        ) : (
          <p className={styles.muted}>Carregando endereço…</p>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionHeading}>Resumo financeiro</h3>
        <dl className={styles.totals}>
          <div className={styles.totalRow}>
            <dt>Subtotal</dt>
            <dd>{formatBRL(order.subtotal)}</dd>
          </div>
          {order.discountTotal > 0 && (
            <div className={styles.totalRow}>
              <dt>Desconto{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
              <dd>− {formatBRL(order.discountTotal)}</dd>
            </div>
          )}
          <div className={styles.totalRow}>
            <dt>Frete</dt>
            <dd>{formatBRL(order.shippingTotal)}</dd>
          </div>
          <div className={`${styles.totalRow} ${styles.totalRowGrand}`}>
            <dt>Total</dt>
            <dd>{formatBRL(order.grandTotal)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
