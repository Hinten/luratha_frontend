"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Address, Order } from "@luratha/schemas";
import OrderStatusBadge from "@/src/components/conta/OrderStatusBadge";
import PaymentMethodBadge from "@/src/components/conta/PaymentMethodBadge";
import PixDisplay from "@/src/components/checkout/PixDisplay";
import BoletoDisplay from "@/src/components/checkout/BoletoDisplay";
import ReorderButton from "@/src/components/conta/ReorderButton";
import styles from "./page.module.css";

/** Vencimento no passado? `false` quando a data é ausente/inválida. */
function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  const time = new Date(expiresAt).getTime();
  return !Number.isNaN(time) && time < Date.now();
}

export default function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [addressMissing, setAddressMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
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
        const addrRes = await fetch(`/api/users/${encodeURIComponent(uid)}/addresses/${addressId}`);
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
        <Link href="/conta/pedidos" className={styles.backLink}>
          ← Voltar para meus pedidos
        </Link>
      </div>
    );
  }
  if (!order) return null;

  const created = new Date(order.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // O pedido ainda precisa de pagamento enquanto `status === "pending_payment"`
  // (vale para `paymentStatus` pending E failed — um PIX/boleto expirado vira
  // `failed` no webhook, mas a Order continua aguardando pagamento). Reexibimos
  // o artefato persistido quando ainda válido; caso contrário, um aviso claro.
  const awaitingPayment = order.status === "pending_payment";
  const pixValid = !!order.paymentPix && !isExpired(order.paymentPix.expiresAt);
  const boletoValid = !!order.paymentBoleto && !isExpired(order.paymentBoleto.expiresAt);

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
        <div className={styles.headerBadges}>
          <OrderStatusBadge order={order} />
          <PaymentMethodBadge method={order.paymentMethod} />
        </div>
      </header>

      {awaitingPayment && order.paymentMethod === "pix" && (
        <section className={styles.section}>
          <h3 className={styles.sectionHeading}>Pagamento via PIX</h3>
          {pixValid && order.paymentPix ? (
            <PixDisplay
              qrCode={order.paymentPix.qrCode}
              qrCodeBase64={order.paymentPix.qrCodeBase64}
              expiresAt={order.paymentPix.expiresAt}
            />
          ) : (
            <>
              <p className={styles.paymentNote}>
                O código PIX deste pedido expirou ou não está mais disponível. Refaça o pedido com
                os preços e itens atuais:
              </p>
              <ReorderButton orderId={order.id} />
            </>
          )}
        </section>
      )}

      {awaitingPayment && order.paymentMethod === "boleto" && (
        <section className={styles.section}>
          <h3 className={styles.sectionHeading}>Pagamento via boleto</h3>
          {boletoValid && order.paymentBoleto ? (
            <BoletoDisplay
              url={order.paymentBoleto.url}
              digitableLine={order.paymentBoleto.digitableLine}
              barcode={order.paymentBoleto.barcode}
            />
          ) : (
            <>
              <p className={styles.paymentNote}>
                O boleto deste pedido expirou ou não está mais disponível. Refaça o pedido com os
                preços e itens atuais:
              </p>
              <ReorderButton orderId={order.id} />
            </>
          )}
        </section>
      )}

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
            {address.recipientName}
            <br />
            {address.line1}, {address.number}
            {address.complement ? ` — ${address.complement}` : ""}
            <br />
            {address.neighborhood} · {address.city}/{address.state}
            <br />
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
