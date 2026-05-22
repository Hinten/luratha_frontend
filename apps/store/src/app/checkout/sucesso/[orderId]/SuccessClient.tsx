"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/src/contexts/CartContext";

/**
 * Cliente que limpa o carrinho ao montar a página de sucesso.
 *
 * Renderiza nada — só side-effect. O server component pai já carregou e
 * validou a Order; aqui só garantimos que o cart local não fica com itens
 * "fantasma" depois do checkout.
 *
 * Idempotente: a ref evita rodar duas vezes em StrictMode.
 */
export default function SuccessClient() {
  const { clearCart } = useCart();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void clearCart();
  }, [clearCart]);

  return null;
}
