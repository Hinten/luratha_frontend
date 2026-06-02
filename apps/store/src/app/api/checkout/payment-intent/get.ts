import { NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@luratha/auth/requireUser";
import { getOrderArtifacts, loadOrder, PaymentProviderError } from "@luratha/payments";

export const runtime = "nodejs";

/**
 * Status em que o pagamento não vai avançar e não há artefato a gerar — o
 * polling do client deve parar. Devolvemos o status sem reler o MP (round-trip
 * desnecessário). `paid` é tratado à parte (client redireciona pro sucesso).
 */
const TERMINAL_FAILURE_STATUSES = new Set(["failed", "refunded", "charged_back", "unknown"]);

/**
 * GET /api/checkout/payment-intent?orderId=...
 *
 * Polling do artefato de pagamento (QR Code do PIX / dados do boleto) quando o
 * MercadoPago cria a order mas ainda não devolveu o artefato (geração
 * assíncrona). O client consulta este endpoint a cada 15s até o artefato chegar
 * (ou desistir após 2min). Relê a MESMA order no MP — nunca recria.
 *
 * Resp 200:
 *   { status, pix? }     — PIX, com `pix` quando o QR já foi gerado
 *   { status, boleto? }  — boleto, com `boleto` quando já foi gerado
 *   { status: "paid" }   — pagamento já confirmado (client redireciona)
 */
export async function GET(request: Request) {
  let authedUser;
  try {
    authedUser = await requireUser();
  } catch (e) {
    const r = authErrorResponse(e);
    if (r) return r;
    throw e;
  }

  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId) {
    return NextResponse.json({ message: "Parâmetro 'orderId' obrigatório." }, { status: 400 });
  }

  const order = await loadOrder(orderId);
  if (!order) {
    return NextResponse.json({ message: `Pedido "${orderId}" não encontrado.` }, { status: 404 });
  }
  if (order.userId !== authedUser.uid) {
    return NextResponse.json(
      { message: "Este pedido não pertence ao usuário autenticado." },
      { status: 403 },
    );
  }

  // Pagamento já confirmado por outra via (ex.: webhook): client pode parar e
  // redirecionar para a página de sucesso.
  if (order.paymentStatus === "paid") {
    return NextResponse.json({ status: "paid" }, { status: 200 });
  }

  // Falha terminal (recusa/estorno/`unknown` fail-safe): o artefato não virá e o
  // pedido não avança sozinho — devolve o status pro client parar o polling e
  // mostrar a mensagem certa, sem gastar um GET no MercadoPago.
  if (TERMINAL_FAILURE_STATUSES.has(order.paymentStatus)) {
    return NextResponse.json({ status: order.paymentStatus }, { status: 200 });
  }

  if (!order.paymentIntentId) {
    return NextResponse.json(
      { message: "Pagamento ainda não iniciado para este pedido." },
      { status: 409 },
    );
  }

  try {
    const artifacts = await getOrderArtifacts(order.paymentIntentId);
    return NextResponse.json(artifacts, { status: 200 });
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      const status =
        error.code === "config_missing" ? 500 : error.code === "invalid_input" ? 400 : 502;
      return NextResponse.json({ message: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
