export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>Luratha — MercadoPago Webhook</h1>
      <p>
        Este backend recebe notificações da API de Orders do MercadoPago em
        <code> POST /api/webhooks/mercadopago</code>. Nenhuma página pública é servida aqui.
      </p>
    </main>
  );
}
