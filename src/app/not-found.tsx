import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-24 text-center"
      style={{ backgroundColor: "var(--color-neutral-light)" }}
    >
      {/* Decorative accent */}
      <div
        className="w-16 h-1 rounded-full mb-8"
        style={{ backgroundColor: "var(--color-primary)" }}
      />

      <p
        className="text-sm font-medium uppercase tracking-widest mb-4"
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--color-secondary)",
        }}
      >
        Página não encontrada
      </p>

      <h1
        className="text-6xl md:text-8xl font-bold mb-6 leading-none"
        style={{
          fontFamily: "var(--font-heading)",
          color: "var(--color-neutral-dark)",
        }}
      >
        404
      </h1>

      <p
        className="text-base md:text-lg mb-10 max-w-md leading-relaxed"
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--color-neutral-dark)",
          opacity: 0.75,
        }}
      >
        A página que você procura não foi encontrada. Explore nossas peças e
        descubra algo especial.
      </p>

      <Link
        href="/"
        className="px-8 py-4 rounded-3xl font-medium transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 inline-block"
        style={{
          backgroundColor: "var(--color-primary)",
          color: "var(--color-neutral-dark)",
          fontFamily: "var(--font-body)",
        }}
      >
        Voltar para o início
      </Link>

      {/* Decorative accent bottom */}
      <div
        className="w-16 h-1 rounded-full mt-8"
        style={{ backgroundColor: "var(--color-secondary)" }}
      />
    </div>
  );
}
