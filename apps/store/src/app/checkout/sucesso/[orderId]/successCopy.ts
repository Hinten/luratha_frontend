import type { Order } from "@luratha/schemas";

/**
 * Copy da tela de sucesso do checkout, ramificado pelo estado do pedido.
 *
 * Motivação (issue #183): a página mostrava sempre "Obrigada pela compra!",
 * mesmo quando o pedido está em `pending_payment` (PIX/boleto ainda não pagos
 * ou cartão em análise). Isso fazia o cliente achar que finalizou e abandonar
 * o pagamento. Aqui alinhamos o copy ao mesmo estado que o `JsonLd` já expõe
 * (`paid` → `OrderProcessing`, caso contrário `OrderPaymentDue`).
 *
 * Ramos: pago → agradecimento; `pending_payment` → "aguardando pagamento" com
 * o próximo passo por `paymentMethod` (PIX / boleto / cartão em análise).
 */

export interface SuccessCopy {
  eyebrow: string;
  heading: string;
  awaitingPayment: boolean;
  /**
   * Próximo passo do cliente. Quando `awaitingPayment`, é a orientação de
   * pagamento (renderizada num callout em destaque); quando pago, é a frase de
   * acompanhamento (renderizada inline no lead).
   */
  nextStep: string;
}

const NEXT_STEP_BY_METHOD: Record<Order["paymentMethod"], string> = {
  pix: "Falta pouco: conclua o pagamento no app do seu banco com o QR Code ou o código copia e cola. Assim que o PIX cair, confirmamos seu pedido automaticamente.",
  boleto:
    "Falta pouco: pague o boleto em qualquer banco ou internet banking. O pedido é confirmado após a compensação, em 1–2 dias úteis.",
  credit_card:
    "Seu pagamento está em análise. Avisaremos por e-mail assim que ele for aprovado — não é preciso fazer nada agora.",
};

const EYEBROW_BY_METHOD: Record<Order["paymentMethod"], string> = {
  pix: "Aguardando pagamento",
  boleto: "Aguardando pagamento",
  credit_card: "Pagamento em análise",
};

/**
 * Status que implicam pagamento já confirmado (despacho em andamento ou
 * concluído). Só estes recebem o agradecimento — `cancelled`/`refunded`/
 * `unknown` caem no fallback neutro para não exibir "Obrigada pela compra!"
 * num pedido que não foi pago.
 */
const CONFIRMED_STATUSES: ReadonlySet<Order["status"]> = new Set([
  "paid",
  "processing",
  "shipped",
  "delivered",
]);

export function getSuccessCopy(order: Pick<Order, "status" | "paymentMethod">): SuccessCopy {
  if (order.status === "pending_payment") {
    return {
      eyebrow: EYEBROW_BY_METHOD[order.paymentMethod],
      heading: "Pedido recebido!",
      awaitingPayment: true,
      nextStep: NEXT_STEP_BY_METHOD[order.paymentMethod],
    };
  }

  if (CONFIRMED_STATUSES.has(order.status)) {
    return {
      eyebrow: "Pedido confirmado",
      heading: "Obrigada pela compra!",
      awaitingPayment: false,
      nextStep: "Você pode acompanhar o status na sua conta.",
    };
  }

  // cancelled / refunded / unknown (fail-safe): nem agradecimento nem cobrança —
  // direciona ao acompanhamento, evitando um copy enganoso.
  return {
    eyebrow: "Status do pedido",
    heading: "Acompanhe seu pedido",
    awaitingPayment: false,
    nextStep: "Veja os detalhes e o status atualizado na sua conta.",
  };
}
