export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>Luratha — Feeds de catálogo</h1>
      <p>
        Este backend gera o feed de produtos do catálogo em
        <code> GET /api/feeds/products.xml</code> (Google Merchant Center / Facebook Catalog) e um
        relatório de qualidade em <code> GET /api/feeds/quality.json</code>. Nenhuma página pública
        é servida aqui.
      </p>
    </main>
  );
}
