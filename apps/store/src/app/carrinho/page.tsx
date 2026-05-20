"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/src/contexts/CartContext";
import { useCartShipping } from "@/src/hooks/useCartShipping";
import ShippingCepForm from "@/src/components/shipping/ShippingCepForm";
import CartShippingOptions, {
  cartShippingQuoteKey,
} from "@/src/components/shipping/CartShippingOptions";
import styles from "./page.module.css";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CarrinhoPage() {
  const router = useRouter();
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
    isReady,
    isSyncing,
    error,
  } = useCart();

  const shipping = useCartShipping(items);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const isEmpty = items.length === 0;

  const cheapest =
    shipping.quotes.length > 0
      ? shipping.quotes.reduce((a, b) => (b.price < a.price ? b : a))
      : null;
  const cheapestKey = cheapest ? cartShippingQuoteKey(cheapest) : null;
  const eligibleForFreeShipping =
    shipping.freeShippingThreshold !== null &&
    totalPrice >= shipping.freeShippingThreshold;

  const validKeys = new Set(shipping.quotes.map(cartShippingQuoteKey));
  const effectiveKey =
    selectedKey !== null && validKeys.has(selectedKey) ? selectedKey : cheapestKey;
  const selectedQuote =
    shipping.quotes.find((q) => cartShippingQuoteKey(q) === effectiveKey) ?? null;
  const selectedShippingCost =
    selectedQuote === null
      ? null
      : eligibleForFreeShipping && effectiveKey === cheapestKey
        ? 0
        : selectedQuote.price;
  const grandTotal = totalPrice + (selectedShippingCost ?? 0);

  return (
    <main className={styles.page}>
      <div className={`container-luratha ${styles.inner}`}>
        <h1 className={styles.heading}>Meu Carrinho</h1>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {!isReady ? (
          <p className={styles.emptyText} aria-live="polite">
            Carregando carrinho…
          </p>
        ) : isEmpty ? (
          /* ── Empty state ── */
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              🛍️
            </span>
            <p className={styles.emptyTitle}>Seu carrinho está vazio</p>
            <p className={styles.emptyText}>
              Explore nossas peças e adicione seus favoritos aqui.
            </p>
            <Link href="/todas-as-pecas" className={styles.emptyLink}>
              Ver Categorias
            </Link>
          </div>
        ) : (
          /* ── Filled cart ── */
          <div className={styles.layout}>
            {/* Items list */}
            <section aria-label="Itens do carrinho">
              <ul className={styles.itemsList} role="list">
                {items.map((item, index) => (
                  <li key={item.id} className={styles.item}>
                    {/* Thumbnail */}
                    <Link
                      href={`/produto/${item.productSlug}`}
                      className={styles.itemThumbLink}
                      aria-hidden="true"
                      tabIndex={-1}
                    >
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={100}
                        height={100}
                        sizes="(max-width: 640px) 88px, 100px"
                        className={styles.itemThumb}
                        loading={index < 3 ? "eager" : "lazy"}
                      />
                    </Link>

                    {/* Body */}
                    <div className={styles.itemBody}>
                      <p className={styles.itemName}>
                        <Link
                          href={`/produto/${item.productSlug}`}
                          className={styles.itemNameLink}
                        >
                          {item.name}
                        </Link>
                      </p>
                      {item.variantLabel ? (
                        <p className={styles.itemMeta}>{item.variantLabel}</p>
                      ) : null}
                      <p className={styles.itemPrice}>{formatBRL(item.unitPrice)}</p>

                      <div className={styles.itemFooter}>
                        {/* Quantity stepper */}
                        <div
                          className={styles.stepper}
                          role="group"
                          aria-label={`Quantidade de ${item.name}`}
                        >
                          <button
                            type="button"
                            className={styles.stepperBtn}
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            disabled={isSyncing}
                            aria-label="Diminuir quantidade"
                          >
                            −
                          </button>
                          <span className={styles.stepperCount} aria-live="polite">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            className={styles.stepperBtn}
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={isSyncing}
                            aria-label="Aumentar quantidade"
                          >
                            +
                          </button>
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={() => removeItem(item.id)}
                          disabled={isSyncing}
                          aria-label={`Remover ${item.name} do carrinho`}
                        >
                          ✕ Remover
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Order summary */}
            <aside aria-label="Resumo do pedido" className={styles.summary}>
              <h2 className={styles.summaryTitle}>Resumo do pedido</h2>

              <div className={styles.summaryRow}>
                <span className={styles.summaryRowLabel}>
                  Subtotal ({totalItems}{" "}
                  {totalItems === 1 ? "item" : "itens"})
                </span>
                <span>{formatBRL(totalPrice)}</span>
              </div>

              <ShippingCepForm title="Calcular frete" />

              <CartShippingOptions
                quotes={shipping.quotes}
                freeShippingThreshold={shipping.freeShippingThreshold}
                subtotal={totalPrice}
                loading={shipping.loading}
                error={shipping.error}
                hasPostalCode={shipping.postalCode !== null}
                selectedKey={effectiveKey ?? ""}
                onSelect={setSelectedKey}
              />

              <div className={styles.summaryRow}>
                <span className={styles.summaryRowLabel}>Frete</span>
                <span>
                  {selectedShippingCost === null
                    ? shipping.loading
                      ? "Calculando…"
                      : "A calcular"
                    : selectedShippingCost === 0
                      ? "Grátis"
                      : formatBRL(selectedShippingCost)}
                </span>
              </div>

              <hr className={styles.summaryDivider} />

              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Total</span>
                <span>{formatBRL(grandTotal)}</span>
              </div>

              <button
                type="button"
                className={styles.checkoutBtn}
                onClick={() => router.push("/checkout")}
                disabled={isSyncing || items.length === 0}
              >
                Finalizar Compra
              </button>

              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => clearCart()}
                disabled={isSyncing}
              >
                Limpar carrinho
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
