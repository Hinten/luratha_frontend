import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { firestoreCollections, type Order } from "@luratha/schemas";
import { AuthError, requireUser } from "@luratha/auth/requireUser";
import JsonLd, { type JsonLdData } from "@/src/components/JsonLd";
import SuccessClient from "./SuccessClient";
import styles from "./page.module.css";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Pedido confirmado — Luratha",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ orderId: string }>;
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

async function loadOrder(orderId: string): Promise<Order | null> {
  const ref = adminDb
    .collection(firestoreCollections.orders)
    .doc(orderId)
    .withConverter(adminOrderConverter);
  const snap = await ref.get();
  return snap.exists ? (snap.data() as Order) : null;
}

function orderJsonLd(order: Order): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "Order",
    orderNumber: order.orderNumber,
    orderStatus:
      order.status === "paid"
        ? "https://schema.org/OrderProcessing"
        : "https://schema.org/OrderPaymentDue",
    priceCurrency: order.currency,
    price: order.grandTotal,
    seller: {
      "@type": "Organization",
      name: "Luratha",
    },
    acceptedOffer: order.items.map((it) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Product", name: it.name, sku: it.itemSku },
      price: it.unitPrice,
      priceCurrency: order.currency,
      eligibleQuantity: { "@type": "QuantitativeValue", value: it.quantity },
    })),
  };
}

export default async function CheckoutSuccessPage({ params }: PageProps) {
  const { orderId } = await params;

  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/login?redirect=${encodeURIComponent(`/checkout/sucesso/${orderId}`)}`);
    }
    throw err;
  }

  const order = await loadOrder(orderId);
  if (!order) notFound();
  if (order.userId !== user.uid) notFound();

  return (
    <main className={styles.page}>
      <JsonLd data={orderJsonLd(order)} />
      <SuccessClient />

      <div className={styles.card}>
        <p className={styles.eyebrow}>Pedido confirmado</p>
        <h1 className={styles.heading}>Obrigada pela compra!</h1>
        <p className={styles.lead}>
          Recebemos seu pedido <strong>{order.orderNumber}</strong>. Você pode acompanhar o status
          na sua conta.
        </p>

        <dl className={styles.totals}>
          <div className={styles.row}>
            <dt>Itens</dt>
            <dd>{order.itemCount}</dd>
          </div>
          <div className={styles.row}>
            <dt>Subtotal</dt>
            <dd>{brl.format(order.subtotal)}</dd>
          </div>
          {order.discountTotal > 0 && (
            <div className={styles.row}>
              <dt>Desconto</dt>
              <dd>− {brl.format(order.discountTotal)}</dd>
            </div>
          )}
          <div className={styles.row}>
            <dt>Frete</dt>
            <dd>{order.shippingTotal === 0 ? "Grátis" : brl.format(order.shippingTotal)}</dd>
          </div>
          <div className={`${styles.row} ${styles.totalRow}`}>
            <dt>Total</dt>
            <dd>{brl.format(order.grandTotal)}</dd>
          </div>
        </dl>

        <div className={styles.actions}>
          <Link href={`/conta/pedidos/${order.id}`} className={styles.primaryBtn}>
            Acompanhar pedido
          </Link>
          <Link href="/" className={styles.secondaryBtn}>
            Continuar comprando
          </Link>
        </div>
      </div>
    </main>
  );
}
