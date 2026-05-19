import styles from "./InfoTooltip.module.css";

interface InfoTooltipProps {
  /** Texto exibido no tooltip e anunciado por leitores de tela. */
  text: string;
  /** Marcador visível que dispara o tooltip. Default "*". */
  marker?: string;
}

/**
 * Marcador inline (default "*") que revela um tooltip em hover ou foco.
 *
 * Acessível sem JS: o gatilho é um `<button>` alcançável por teclado cujo
 * `aria-label` carrega o texto (leitores de tela anunciam ao focar); o tooltip
 * visível é decorativo (`aria-hidden`) e o CSS controla a visibilidade.
 */
export default function InfoTooltip({ text, marker = "*" }: InfoTooltipProps) {
  return (
    <span className={styles.wrapper}>
      <button type="button" className={styles.trigger} aria-label={text}>
        {marker}
      </button>
      <span className={styles.tooltip} aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
