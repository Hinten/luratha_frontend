"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Order, UserProfile } from "@luratha/schemas";
import { getOrderDisplayStatus } from "@/src/lib/orders/orderDisplayStatus";
import styles from "./page.module.css";

export default function ContaDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const uid = user!.uid;
      try {
        const [profileRes, ordersRes] = await Promise.all([
          fetch(`/api/users/${uid}`),
          fetch(`/api/orders?userId=${uid}&limit=1`),
        ]);

        if (cancelled) return;

        if (profileRes.ok) {
          setProfile((await profileRes.json()) as UserProfile);
        }

        if (ordersRes.ok) {
          const orders = (await ordersRes.json()) as Order[];
          setLastOrder(orders[0] ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const firstName = profile?.firstName ?? user.name.split(" ")[0];
  const profileMissing = !loading && !profile;

  return (
    <div className={styles.dashboard}>
      <h2 className={styles.greeting}>Olá, {firstName}</h2>
      <p className={styles.subline}>O que você gostaria de fazer hoje?</p>

      {profileMissing && (
        <div className={styles.alertBox} role="status">
          <p>
            Você ainda não completou seu perfil. Para finalizar uma compra, precisamos dos seus
            dados de contato e fiscais.
          </p>
          <Link href="/conta/dados" className={styles.alertCta}>
            Completar perfil
          </Link>
        </div>
      )}

      <div className={styles.cards}>
        <Link href="/conta/dados" className={styles.card}>
          <span className={styles.cardLabel}>Meus dados</span>
          <span className={styles.cardHint}>Nome, contato e dados fiscais</span>
        </Link>

        <Link href="/conta/enderecos" className={styles.card}>
          <span className={styles.cardLabel}>Endereços</span>
          <span className={styles.cardHint}>Salve onde você quer receber</span>
        </Link>

        <Link href="/conta/pedidos" className={styles.card}>
          <span className={styles.cardLabel}>Pedidos</span>
          <span className={styles.cardHint}>Histórico e status de entrega</span>
        </Link>
      </div>

      <section className={styles.lastOrderSection}>
        <h3 className={styles.sectionHeading}>Último pedido</h3>
        {loading ? (
          <p className={styles.muted}>Carregando…</p>
        ) : lastOrder ? (
          <Link href={`/conta/pedidos/${lastOrder.id}`} className={styles.lastOrderCard}>
            <span className={styles.orderNumber}>#{lastOrder.orderNumber}</span>
            <span className={styles.orderStatus}>{getOrderDisplayStatus(lastOrder).label}</span>
            <span className={styles.orderTotal}>{formatBRL(lastOrder.grandTotal)}</span>
          </Link>
        ) : (
          <p className={styles.muted}>Nenhum pedido ainda.</p>
        )}
      </section>
    </div>
  );
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
