export default function CheckoutLoading() {
  return (
    <main
      style={{
        minHeight: "50vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        color: "color-mix(in srgb, var(--color-neutral-dark) 60%, transparent)",
      }}
    >
      <p>Carregando checkout…</p>
    </main>
  );
}
