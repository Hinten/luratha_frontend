import styles from "./Spinner.module.css";

export interface SpinnerProps {
  /** Tamanho em px (lado do SVG quadrado). Default 16. */
  size?: number;
  className?: string;
}

/**
 * Spinner inline reutilizável. Herda a cor do pai via `currentColor` (combina
 * com o texto do botão). Marcado `aria-hidden` — a semântica de "loading"
 * deve vir do `aria-busy` no botão pai.
 */
export default function Spinner({ size = 16, className }: SpinnerProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={`${styles.spinner} ${className ?? ""}`}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
