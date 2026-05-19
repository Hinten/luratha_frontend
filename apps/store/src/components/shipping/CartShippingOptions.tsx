import InfoTooltip from "@/src/components/InfoTooltip";
import type { ShippingQuote } from "@/src/lib/shipping/types";
import styles from "./CartShippingOptions.module.css";

const FREE_SHIPPING_TOOLTIP =
  "O frete grátis vale para a opção mais barata e depende da região — o valor varia conforme o CEP.";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const cartShippingQuoteKey = (quote: ShippingQuote): string =>
  `${quote.providerId}:${quote.serviceCode}`;

interface CartShippingOptionsProps {
  quotes: ShippingQuote[];
  freeShippingThreshold: number | null;
  /** Subtotal do carrinho — usado para decidir a elegibilidade ao frete grátis. */
  subtotal: number;
  loading: boolean;
  error: boolean;
  hasPostalCode: boolean;
  /** Chave da opção selecionada (`cartShippingQuoteKey`). */
  selectedKey: string;
  onSelect: (key: string) => void;
}

interface OptionRow {
  key: string;
  name: string;
  detail: string;
  priceLabel: string;
}

function deliveryLabel(estimatedDays: number): string {
  if (estimatedDays <= 0) return "";
  return `até ${estimatedDays} ${estimatedDays === 1 ? "dia útil" : "dias úteis"}`;
}

/**
 * Lista selecionável de opções de frete do carrinho.
 *
 * O frete grátis vale apenas para a opção mais barata: quando o carrinho é
 * elegível, ela aparece como "Frete grátis" no topo e as demais transportadoras
 * são listadas pelo preço cheio (o cliente pode escolher uma entrega mais
 * rápida pagando o valor integral). O componente é apenas de apresentação — a
 * cotação vem de `useCartShipping` e o custo selecionado é resolvido na página.
 */
export default function CartShippingOptions({
  quotes,
  freeShippingThreshold,
  subtotal,
  loading,
  error,
  hasPostalCode,
  selectedKey,
  onSelect,
}: CartShippingOptionsProps) {
  if (!hasPostalCode) {
    return (
      <p className={styles.status}>
        Informe seu CEP acima para ver as opções de frete.
      </p>
    );
  }
  if (loading) {
    return (
      <p className={styles.status} aria-live="polite">
        Calculando frete…
      </p>
    );
  }
  if (error || quotes.length === 0) {
    return (
      <p className={styles.status} role="alert">
        Não foi possível calcular o frete para este CEP agora. Tente novamente em
        instantes.
      </p>
    );
  }

  const cheapest = quotes.reduce((a, b) => (b.price < a.price ? b : a));
  const cheapestKey = cartShippingQuoteKey(cheapest);
  const eligible =
    freeShippingThreshold !== null && subtotal >= freeShippingThreshold;
  const remaining =
    freeShippingThreshold !== null ? Math.max(0, freeShippingThreshold - subtotal) : 0;
  const progressPercent =
    freeShippingThreshold !== null && freeShippingThreshold > 0
      ? Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))
      : 0;

  const rows: OptionRow[] = [];
  if (eligible) {
    rows.push({
      key: cheapestKey,
      name: "Frete grátis",
      detail: [`${cheapest.carrier} · ${cheapest.service}`, deliveryLabel(cheapest.estimatedDays)]
        .filter(Boolean)
        .join(" · "),
      priceLabel: "Grátis",
    });
  }
  for (const quote of quotes) {
    const key = cartShippingQuoteKey(quote);
    if (eligible && key === cheapestKey) continue;
    rows.push({
      key,
      name: `${quote.carrier} · ${quote.service}`,
      detail: deliveryLabel(quote.estimatedDays),
      priceLabel: formatBRL(quote.price),
    });
  }

  return (
    <div className={styles.wrapper}>
      {freeShippingThreshold !== null &&
        (eligible ? (
          <p className={styles.note}>
            Sua compra tem frete grátis
            <InfoTooltip text={FREE_SHIPPING_TOOLTIP} /> na opção mais barata.
          </p>
        ) : (
          <div aria-live="polite">
            <p className={styles.note}>
              Faltam {formatBRL(remaining)} para o frete grátis
              <InfoTooltip text={FREE_SHIPPING_TOOLTIP} />.
            </p>
            <div
              className={styles.progressBar}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
            >
              <div
                className={styles.progressFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ))}

      <fieldset className={styles.group}>
        <legend className={styles.groupLegend}>Opções de frete</legend>
        {rows.map((row) => {
          const selected = selectedKey === row.key;
          return (
            <label
              key={row.key}
              className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
            >
              <input
                type="radio"
                name="cart-shipping-option"
                className={styles.radio}
                checked={selected}
                onChange={() => onSelect(row.key)}
              />
              <span className={styles.optionBody}>
                <span className={styles.optionName}>{row.name}</span>
                {row.detail ? (
                  <span className={styles.optionDetail}>{row.detail}</span>
                ) : null}
              </span>
              <span className={styles.optionPrice}>{row.priceLabel}</span>
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
