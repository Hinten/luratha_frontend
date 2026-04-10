"use client";

import Link from "next/link";
import { useCart } from "@/src/contexts/CartContext";
import styles from "./page.module.css";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CarrinhoPage() {
  const { items, removeItem, updateQuantity, clearCart, totalItems, totalPrice } =
    useCart();

  const isEmpty = items.length === 0;

  return (
    <main className={styles.page}>
      <div className={`container-luratha ${styles.inner}`}>
        <h1 className={styles.heading}>Meu Carrinho</h1>

        {isEmpty ? (
          /* ── Empty state ── */
          <div className={styles.empty}>
            <span className={styles.emptyIcon} aria-hidden="true">
              🛍️
            </span>
            <p className={styles.emptyTitle}>Seu carrinho está vazio</p>
            <p className={styles.emptyText}>
              Explore nossas peças e adicione seus favoritos aqui.
            </p>
            <Link href="/colecao" className={styles.emptyLink}>
              Ver coleção
            </Link>
          </div>
        ) : (
          /* ── Filled cart ── */
          <div className={styles.layout}>
            {/* Items list */}
            <section aria-label="Itens do carrinho">
              <ul className={styles.itemsList} role="list">
                {items.map((item) => (
                  <li key={`${item.productId}-${item.size}`} className={styles.item}>
                    {/* Thumbnail */}
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className={styles.itemThumb}
                      loading="lazy"
                    />

                    {/* Body */}
                    <div className={styles.itemBody}>
                      <p className={styles.itemName}>{item.name}</p>
                      <p className={styles.itemMeta}>Tamanho: {item.size}</p>
                      <p className={styles.itemPrice}>{formatBRL(item.price)}</p>

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
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.size,
                                item.quantity - 1,
                              )
                            }
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
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.size,
                                item.quantity + 1,
                              )
                            }
                            aria-label="Aumentar quantidade"
                          >
                            +
                          </button>
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={() => removeItem(item.productId, item.size)}
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

              <div className={styles.summaryRow}>
                <span className={styles.summaryRowLabel}>Frete</span>
                <span>Calcule o frete</span>
              </div>

              <p className={styles.shippingNote}>
                Informe o CEP na próxima etapa.
              </p>

              <hr className={styles.summaryDivider} />

              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Total</span>
                <span>{formatBRL(totalPrice)}</span>
              </div>

              <button
                type="button"
                className={styles.checkoutBtn}
                onClick={() => alert("Em breve: integração com checkout!")}
              >
                Finalizar Compra
              </button>

              <button
                type="button"
                className={styles.clearBtn}
                onClick={clearCart}
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
