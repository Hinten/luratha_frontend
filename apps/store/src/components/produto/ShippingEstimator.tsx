"use client";

import { useSyncExternalStore } from "react";
import {
  getShippingEstimateServerSnapshot,
  getShippingEstimateSnapshot,
  subscribeShippingEstimate,
} from "@/src/lib/shipping/clientStorage";
import InfoTooltip from "@/src/components/InfoTooltip";
import ShippingCepForm from "@/src/components/shipping/ShippingCepForm";
import styles from "./ShippingEstimator.module.css";

const FREE_SHIPPING_TOOLTIP =
  "O frete grátis depende da região de entrega — o valor varia conforme o CEP.";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ShippingEstimatorProps {
  /** Preço unitário do produto — exibido no aviso de referência. */
  productPrice: number;
}

/**
 * Widget de "Consulte o frete" exibido na PDP. O campo de CEP é o
 * `ShippingCepForm` compartilhado; este componente apenas apresenta o
 * resultado (frete grátis + opções de 1kg) lendo o estimate do store.
 */
export default function ShippingEstimator({ productPrice }: ShippingEstimatorProps) {
  const stored = useSyncExternalStore(
    subscribeShippingEstimate,
    getShippingEstimateSnapshot,
    getShippingEstimateServerSnapshot,
  );

  return (
    <section className={styles.wrapper} aria-label="Consulta de frete">
      <ShippingCepForm title="Consulte o frete e prazo" />

      {stored && (
        <div aria-live="polite">
          {stored.freeShippingEnabled && stored.freeShippingThreshold !== null ? (
            <p className={styles.result}>
              Frete <strong>grátis</strong>
              <InfoTooltip text={FREE_SHIPPING_TOOLTIP} /> em compras acima de{" "}
              <strong>{formatBRL(stored.freeShippingThreshold)}</strong> para o CEP{" "}
              {stored.postalCode}.
            </p>
          ) : (
            <p className={styles.result}>
              {stored.freeShippingEnabled
                ? "Frete grátis indisponível para este CEP no momento."
                : "Frete grátis temporariamente desativado."}
            </p>
          )}

          {stored.quotes.length > 0 && (
            <ul className={styles.options}>
              {stored.quotes.map((quote) => (
                <li key={`${quote.providerId}-${quote.serviceCode}`} className={styles.option}>
                  <span className={styles.optionName}>
                    {quote.carrier} · {quote.service}
                  </span>
                  <span className={styles.optionMeta}>
                    a partir de {formatBRL(quote.price)}
                    {quote.estimatedDays > 0 &&
                      ` · ${quote.estimatedDays} ${
                        quote.estimatedDays === 1 ? "dia útil" : "dias úteis"
                      }`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {stored.quotes.length > 0 && (
            <p className={styles.muted}>
              Estimativa para 1kg. O valor final é calculado no carrinho com o peso real das peças.
            </p>
          )}

          {process.env.NODE_ENV === "development" && stored.referenceShippingCost !== null && (
            <p className={styles.muted}>
              [DEV] Referência: frete de 1kg para esse CEP custa{" "}
              {formatBRL(stored.referenceShippingCost)}. Itens deste produto a partir de{" "}
              {formatBRL(productPrice)}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
