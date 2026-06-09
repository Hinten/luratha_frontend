"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { CartItemInput } from "@/src/contexts/CartContext";
import { ApiResponseError, throwIfNotOk } from "@/src/lib/errors";
import Spinner from "@/src/components/Spinner";
import styles from "./ReorderButton.module.css";

interface UnavailableItem {
  name: string;
  reason: string;
}

interface ReorderResponse {
  items: CartItemInput[];
  unavailable: UnavailableItem[];
}

/**
 * Adiciona um item ao carrinho do usuário autenticado. Posta direto no
 * endpoint (em vez de `useCart().addItem`) porque o `addItem` engole
 * `ApiResponseError` para usuários logados — aqui precisamos que a falha
 * propague para não navegar ao checkout com o carrinho incompleto. A página
 * `/conta` é sempre autenticada, então o caminho de guest não se aplica; o
 * `CartProvider` reflete a escrita via onSnapshot.
 */
async function addItemToCart(item: CartItemInput): Promise<void> {
  const response = await fetch("/api/cart/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currency: "BRL", quantity: 1, ...item }),
  });
  await throwIfNotOk(response, "Não foi possível adicionar um item ao carrinho.");
}

type ReorderState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "partial"; unavailable: UnavailableItem[] }
  | { kind: "empty"; unavailable: UnavailableItem[] }
  | { kind: "error" };

/**
 * Botão "Pedir novamente" exibido no estado PIX/boleto expirado de um pedido.
 *
 * Resolve os itens do pedido contra o catálogo atual via
 * `POST /api/orders/:id/reorder`, re-adiciona os disponíveis ao carrinho
 * (preço/slug/imagem atuais) e navega para `/checkout`. Itens indisponíveis são
 * pulados e listados num aviso; nesse caso a navegação não é automática para o
 * cliente conseguir ler o aviso antes de prosseguir.
 */
export default function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ReorderState>({ kind: "idle" });

  const handleClick = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/reorder`, {
        method: "POST",
      });
      await throwIfNotOk(response, "Não foi possível refazer o pedido.");
      const { items, unavailable } = (await response.json()) as ReorderResponse;

      for (const item of items) {
        await addItemToCart(item);
      }

      if (items.length === 0) {
        setState({ kind: "empty", unavailable });
        return;
      }
      if (unavailable.length > 0) {
        setState({ kind: "partial", unavailable });
        return;
      }
      router.push("/checkout");
    } catch (err) {
      // ApiResponseError (resposta não-OK) e TypeError (falha de rede) são
      // recuperáveis — mostramos um aviso de tentar de novo. Qualquer outra
      // coisa é inesperada e propaga para a ErrorBoundary.
      if (err instanceof ApiResponseError || err instanceof TypeError) {
        setState({ kind: "error" });
        return;
      }
      throw err;
    }
  }, [orderId, router]);

  const busy = state.kind === "loading";

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy || undefined}
      >
        {busy ? (
          <>
            <Spinner size={16} /> Refazendo pedido…
          </>
        ) : (
          "Pedir novamente"
        )}
      </button>

      {(state.kind === "partial" || state.kind === "empty") && (
        <div className={styles.notice} role="status" aria-live="polite">
          {state.kind === "empty" ? (
            <p className={styles.noticeText}>
              Nenhum item deste pedido está disponível no momento.
            </p>
          ) : (
            <>
              <p className={styles.noticeText}>
                Estes itens não estão mais disponíveis e não foram adicionados:
              </p>
              <ul className={styles.noticeList}>
                {state.unavailable.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    {item.name} <span className={styles.reason}>({item.reason})</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={styles.continueButton}
                onClick={() => router.push("/checkout")}
              >
                Ir para o checkout
              </button>
            </>
          )}
        </div>
      )}

      {state.kind === "error" && (
        <p className={styles.error} role="alert">
          Não foi possível refazer o pedido. Tente novamente.
        </p>
      )}
    </div>
  );
}
