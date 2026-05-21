"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CartItem } from "@luratha/schemas";
import { useCart } from "@/src/contexts/CartContext";
import { useCartShipping } from "@/src/hooks/useCartShipping";
import ShippingCepForm from "@/src/components/shipping/ShippingCepForm";
import CartShippingOptions, {
  cartShippingQuoteKey,
} from "@/src/components/shipping/CartShippingOptions";
import Spinner from "@/src/components/Spinner";
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
                  <CartItemRow
                    key={item.id}
                    item={item}
                    eager={index < 3}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeItem}
                  />
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

              <ClearCartButton onClear={clearCart} />
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

interface CartItemRowProps {
  item: CartItem;
  eager: boolean;
  onUpdateQuantity: (itemId: string, quantity: number) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
}

/**
 * Linha de item no carrinho com loaders **por botão** (em vez do
 * `isSyncing` global). Clicar `+` no item A só desabilita o `+` do item A —
 * os demais botões continuam clicáveis.
 */
function CartItemRow({ item, eager, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const [pendingInc, setPendingInc] = useState(false);
  const [pendingDec, setPendingDec] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(false);

  async function handleDecrement() {
    setPendingDec(true);
    try {
      await onUpdateQuantity(item.id, item.quantity - 1);
    } finally {
      setPendingDec(false);
    }
  }

  async function handleIncrement() {
    setPendingInc(true);
    try {
      await onUpdateQuantity(item.id, item.quantity + 1);
    } finally {
      setPendingInc(false);
    }
  }

  async function handleRemove() {
    setPendingRemove(true);
    try {
      await onRemove(item.id);
    } finally {
      // Componente pode desmontar quando o item sai da lista — o setState é
      // no-op nesse caso. React ignora silenciosamente em strict mode.
      setPendingRemove(false);
    }
  }

  return (
    <li className={styles.item}>
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
          loading={eager ? "eager" : "lazy"}
        />
      </Link>

      <div className={styles.itemBody}>
        <p className={styles.itemName}>
          <Link href={`/produto/${item.productSlug}`} className={styles.itemNameLink}>
            {item.name}
          </Link>
        </p>
        {item.variantLabel ? (
          <p className={styles.itemMeta}>{item.variantLabel}</p>
        ) : null}
        <p className={styles.itemPrice}>{formatBRL(item.unitPrice)}</p>

        <div className={styles.itemFooter}>
          <div
            className={styles.stepper}
            role="group"
            aria-label={`Quantidade de ${item.name}`}
          >
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={handleDecrement}
              disabled={pendingDec}
              aria-busy={pendingDec || undefined}
              aria-label="Diminuir quantidade"
            >
              {pendingDec ? <Spinner size={14} /> : "−"}
            </button>
            <span className={styles.stepperCount} aria-live="polite">
              {item.quantity}
            </span>
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={handleIncrement}
              disabled={pendingInc}
              aria-busy={pendingInc || undefined}
              aria-label="Aumentar quantidade"
            >
              {pendingInc ? <Spinner size={14} /> : "+"}
            </button>
          </div>

          <button
            type="button"
            className={styles.removeBtn}
            onClick={handleRemove}
            disabled={pendingRemove}
            aria-busy={pendingRemove || undefined}
            aria-label={`Remover ${item.name} do carrinho`}
          >
            {pendingRemove ? (
              <>
                <Spinner size={14} /> Removendo…
              </>
            ) : (
              "✕ Remover"
            )}
          </button>
        </div>
      </div>
    </li>
  );
}

function ClearCartButton({ onClear }: { onClear: () => Promise<void> }) {
  const [pending, setPending] = useState(false);

  async function handleClear() {
    setPending(true);
    try {
      await onClear();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={styles.clearBtn}
      onClick={handleClear}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          <Spinner size={14} /> Limpando…
        </>
      ) : (
        "Limpar carrinho"
      )}
    </button>
  );
}
