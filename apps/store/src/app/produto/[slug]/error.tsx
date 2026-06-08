"use client";

interface ProductErrorPageProps {
  error: Error & { digest?: string; statusCode?: number };
  reset: () => void;
}

export default function ProductErrorPage({ error, reset }: ProductErrorPageProps) {
  const statusCode = error.statusCode ?? 500;

  return (
    <div className="container-luratha section-padding">
      <h1 className="mb-4 font-[family-name:var(--font-heading)] text-3xl">Erro {statusCode}</h1>
      <p className="mb-6 font-[family-name:var(--font-body)]">
        {error.message || "Não foi possível carregar o produto no momento."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center rounded-md bg-[var(--color-primary)] px-5 py-2.5 font-[family-name:var(--font-body)] text-[var(--color-neutral-dark)] hover:bg-[var(--color-primary-hover)]"
      >
        Tentar novamente
      </button>
    </div>
  );
}
