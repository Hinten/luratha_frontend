import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/src/lib/payment/mercadoPago";
import { applyPaymentWebhook } from "@/src/lib/payment/service";
import { PaymentProviderError } from "@/src/lib/payment/types";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/mercadopago
 *
 * Receiver de notificações do MercadoPago. Endpoint público (chamado pelos
 * servidores do MP) — a segurança é a validação da assinatura `x-signature`,
 * NÃO há `requireUser`.
 *
 * Em notificações de pagamento, consulta o pagamento no MP e atualiza a Order
 * correspondente (`external_reference`). Idempotente: reenvios do mesmo evento
 * não reescrevem o pedido.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const queryDataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  let body: unknown = null;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : null;
  } catch (err) {
    if (err instanceof SyntaxError) {
      // O MercadoPago às vezes notifica apenas via query string — sem corpo JSON.
      body = null;
    } else {
      throw err;
    }
  }

  const bodyObj =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const dataField = bodyObj.data;
  const bodyDataIdRaw =
    dataField && typeof dataField === "object" && !Array.isArray(dataField)
      ? (dataField as Record<string, unknown>).id
      : undefined;
  const bodyDataId =
    typeof bodyDataIdRaw === "string"
      ? bodyDataIdRaw
      : typeof bodyDataIdRaw === "number"
        ? String(bodyDataIdRaw)
        : null;
  const dataId = queryDataId ?? bodyDataId;

  const type =
    (typeof bodyObj.type === "string" ? bodyObj.type : url.searchParams.get("type")) ??
    url.searchParams.get("topic");

  let signatureValid: boolean;
  try {
    signatureValid = verifyWebhookSignature({
      signatureHeader: request.headers.get("x-signature"),
      requestId: request.headers.get("x-request-id"),
      dataId,
    });
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      // MERCADOPAGO_WEBHOOK_SECRET ausente — erro de configuração do servidor.
      return NextResponse.json({ message: error.message, code: error.code }, { status: 500 });
    }
    throw error;
  }

  if (!signatureValid) {
    return NextResponse.json({ message: "Assinatura do webhook inválida." }, { status: 401 });
  }

  // Apenas notificações de pagamento são acionáveis; o resto é apenas confirmado.
  if (type !== "payment" || !dataId) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    const outcome = await applyPaymentWebhook(dataId);
    return NextResponse.json({ received: true, ...outcome }, { status: 200 });
  } catch (error) {
    if (error instanceof PaymentProviderError) {
      if (error.code === "invalid_input") {
        // Pagamento sem pedido correspondente (ex.: pagamento de outra loja no
        // mesmo app, ou teste). Confirma 200 para o MP não reentregar.
        return NextResponse.json({ received: true, ignored: error.message }, { status: 200 });
      }
      // Provider indisponível / configuração — devolve 500 para o MP reentregar.
      return NextResponse.json({ message: error.message, code: error.code }, { status: 500 });
    }
    throw error;
  }
}
