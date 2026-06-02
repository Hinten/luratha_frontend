/**
 * Ícone de "check" para confirmar uma ação (ex.: "Copiado!"). Mesmo padrão
 * inline do projeto: stroke `currentColor`, tamanho via CSS, decorativo.
 */
export default function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
