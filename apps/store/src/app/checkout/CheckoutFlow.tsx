"use client";

import { startTransition, useEffect, useReducer, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Address, CartItem, UserProfile } from "@luratha/schemas";
import { useAuth } from "@/src/contexts/AuthContext";
import { useCart } from "@/src/contexts/CartContext";
import { ApiResponseError } from "@/src/lib/errors";
import { formatCpf } from "@/src/lib/format/cpf";
import Spinner from "@/src/components/Spinner";
import AddressStep from "@/src/components/checkout/AddressStep";
import ShippingStep, {
  type ShippingQuote,
} from "@/src/components/checkout/ShippingStep";
import PaymentStep, {
  type PaymentSubmitPayload,
} from "@/src/components/checkout/PaymentStep";
import PaymentResult, {
  type PaymentResultData,
} from "@/src/components/checkout/PaymentResult";
import StepIndicator, {
  type CheckoutStep,
} from "@/src/components/checkout/StepIndicator";
import OrderSummary, {
  type AppliedCoupon,
} from "@/src/components/checkout/OrderSummary";
import CouponField from "@/src/components/checkout/CouponField";
import ReviewSummary from "@/src/components/checkout/ReviewSummary";
import styles from "./CheckoutFlow.module.css";

/**
 * Steps visíveis na URL (`?step=...`) — refletidos no histórico do navegador,
 * permitindo back/forward natural entre as 4 etapas. O step "result" é uma
 * view transiente (pós-submit), derivada da presença de `state.paymentResult`
 * em memória; não tem URL própria.
 */
type VisibleStepId = "address" | "shipping" | "payment" | "review";
type StepId = VisibleStepId | "result";

const VISIBLE_STEPS: CheckoutStep[] = [
  { id: "address", label: "Endereço" },
  { id: "shipping", label: "Frete" },
  { id: "review", label: "Revisão" },
  { id: "payment", label: "Pagamento" },
];

function isVisibleStepId(value: string | null): value is VisibleStepId {
  return (
    value === "address" ||
    value === "shipping" ||
    value === "payment" ||
    value === "review"
  );
}

interface State {
  address: Address | null;
  quote: ShippingQuote | null;
  appliedCoupon: AppliedCoupon | null;
  paymentResult: PaymentResultData | null;
  orderId: string | null;
  submitting: boolean;
  error: string | null;
}

type Action =
  | { type: "SET_ADDRESS"; address: Address }
  | { type: "SET_QUOTE"; quote: ShippingQuote }
  | { type: "APPLY_COUPON"; coupon: AppliedCoupon }
  | { type: "CLEAR_COUPON" }
  | { type: "CLEAR_ERROR" }
  | { type: "TRY_AGAIN" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_OK"; orderId: string; result: PaymentResultData }
  | { type: "SUBMIT_FAIL"; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_ADDRESS":
      return { ...state, address: action.address };
    case "SET_QUOTE":
      return { ...state, quote: action.quote };
    case "APPLY_COUPON":
      return { ...state, appliedCoupon: action.coupon };
    case "CLEAR_COUPON":
      return { ...state, appliedCoupon: null };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "TRY_AGAIN":
      return { ...state, paymentResult: null, orderId: null, error: null };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };
    case "SUBMIT_OK":
      return {
        ...state,
        submitting: false,
        orderId: action.orderId,
        paymentResult: action.result,
      };
    case "SUBMIT_FAIL":
      return { ...state, submitting: false, error: action.message };
  }
}

function emptyInitial(): State {
  return {
    address: null,
    quote: null,
    appliedCoupon: null,
    paymentResult: null,
    orderId: null,
    submitting: false,
    error: null,
  };
}

/**
 * Garante que o step solicitado satisfaz os pré-requisitos de estado.
 * Deep link em `?step=payment` sem endereço/frete cai pra "address" — bloqueia
 * pular etapas via URL e mantém a navegação consistente com o reducer.
 *
 * Ordem: Endereço → Frete → Revisão → Pagamento. Review e Payment exigem os
 * mesmos pré-requisitos (address + quote); o que diferencia é que Payment é
 * onde o user finaliza o pagamento (chama `confirmOrder`).
 */
function enforceStepPrereqs(
  requested: VisibleStepId,
  state: State,
): VisibleStepId {
  if (requested === "shipping" && !state.address) return "address";
  if (
    (requested === "review" || requested === "payment") &&
    (!state.address || !state.quote)
  ) {
    return "address";
  }
  return requested;
}

function orderItemsFromCart(items: CartItem[]) {
  return items.map((i) => ({
    id: i.id,
    productId: i.productId,
    ...(i.variantId ? { variantId: i.variantId } : {}),
    itemSku: i.variantSku,
    name: i.name,
    photoId: i.photoId,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.unitPrice * i.quantity,
    currency: "BRL" as const,
  }));
}

function makeOrderNumber(): string {
  // LR-{base36 ts}-{4 rnd alfanum}
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LR-${ts}-${rnd}`;
}

function shippingAddressPath(userId: string, addressId: string): string {
  return `userProfiles/${userId}/addresses/${addressId}`;
}

// 25s: margem confortável sobre os 10s do SDK MP server-side + round-trip + Firestore.
const CONFIRM_TIMEOUT_MS = 25_000;

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Persiste lastName + taxIdentity (CPF) no UserProfile após a Order ser
 * criada, pra próxima compra pré-popular esses campos. Best-effort:
 * se falhar, NÃO bloqueia o pagamento — só loga. PJ fica fora porque o
 * form do checkout não coleta legalName/stateRegistration exigidos pelo
 * userProfileSchema PJ.
 */
async function persistProfileFields(
  userId: string,
  payer: PaymentSubmitPayload["payer"],
): Promise<void> {
  const patchBody: Record<string, unknown> = { lastName: payer.lastName };
  if (payer.identification.type === "CPF") {
    patchBody.taxIdentity = {
      type: "PF",
      cpf: formatCpf(payer.identification.number),
    };
  }

  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new ApiResponseError(
        body.message ?? "Falha ao salvar perfil.",
        res.status,
      );
    }
  } catch (err) {
    if (err instanceof ApiResponseError) {
      console.warn(
        `[checkout] PATCH /api/users/${userId} falhou ${err.status}: ${err.message}`,
      );
      return;
    }
    if (err instanceof TypeError) {
      console.warn(`[checkout] PATCH /api/users/${userId} rede falhou: ${err.message}`);
      return;
    }
    throw err;
  }
}

export default function CheckoutFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  // `clearCart` é chamado em confirmOrder() depois do payment-intent OK pra
  // PIX/Boleto, antes de mostrar o `PaymentResult`. O CheckoutPage guard de
  // cart vazio precisa de bypass quando `state.paymentResult` está presente —
  // sem isso, o user seria redirecionado pro /carrinho assim que o cart
  // esvazia, em vez de ver o QR/boleto. O guard local (mais abaixo) faz isso.
  const { items, isReady: cartReady, clearCart } = useCart();
  const [state, dispatch] = useReducer(reducer, undefined, emptyInitial);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // URL → step (com fallback pra "address" se o param for inválido).
  const rawStepParam = searchParams.get("step");
  const requestedStep: VisibleStepId = isVisibleStepId(rawStepParam)
    ? rawStepParam
    : "address";
  const urlStep: VisibleStepId = enforceStepPrereqs(requestedStep, state);

  // Se temos resultado de pagamento em memória, ele sobrepõe o urlStep —
  // o user precisa ver o QR/confirmação até clicar "Acompanhar pedido".
  const showingResult =
    state.paymentResult !== null && state.orderId !== null;
  const activeStep: StepId = showingResult ? "result" : urlStep;

  // Sincroniza a URL quando o requested foi rebaixado pelos pré-reqs
  // (deep link em ?step=review sem ter passado pelo address, etc.).
  useEffect(() => {
    if (urlStep !== requestedStep) {
      router.replace(`/checkout?step=${urlStep}`);
    }
  }, [urlStep, requestedStep, router]);

  // Guard de carrinho vazio. Bypassa quando há `paymentResult` em memória —
  // isso acontece imediatamente após o submit de PIX/Boleto, quando o cart é
  // limpo pra zerar mas o user precisa continuar vendo o QR/boleto até clicar
  // "Acompanhar pedido". Sem esse bypass, o user seria redirecionado pro
  // /carrinho assim que clearCart() terminasse.
  useEffect(() => {
    if (!cartReady) return;
    if (items.length > 0) return;
    if (state.paymentResult) return;
    router.replace("/carrinho");
  }, [cartReady, items.length, state.paymentResult, router]);

  // Carrega o UserProfile uma vez por sessão pra pré-popular o PaymentStep
  // (email, nome, CPF). Falha silenciosa: se 404 ou rede ruim, os campos
  // do form vêm vazios e o usuário preenche manualmente — não bloqueamos.
  const userId = user?.uid;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        if (!res.ok) return;
        const data = (await res.json()) as UserProfile;
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (!(err instanceof TypeError)) throw err;
        // fetch lança TypeError em falha de rede — silencioso aqui.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Scroll pro topo a cada troca de step. Sem isso, ao avançar de Address
  // (botão Continuar no rodapé) pro Shipping, o usuário vê a página rolada
  // pra baixo, ficando perdido. O StepIndicator no topo dá contexto visual.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep]);

  if (!user) return null;

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const discountTotal = state.appliedCoupon?.discount ?? 0;
  const shippingTotal = state.quote?.price ?? 0;
  const grandTotal = Math.max(0, subtotal - discountTotal + shippingTotal);

  // `startTransition` marca a mudança de URL como não-urgente: o Suspense
  // boundary do CheckoutPage mantém a UI anterior visível enquanto o Next
  // processa a nova rota, em vez de mostrar `fallback={null}` (flash branco).
  // Sem isso a transição entre steps tem latência perceptível.
  function goToStep(step: VisibleStepId) {
    dispatch({ type: "CLEAR_ERROR" });
    startTransition(() => {
      router.push(`/checkout?step=${step}`);
    });
  }

  function goBack() {
    dispatch({ type: "CLEAR_ERROR" });
    startTransition(() => {
      router.back();
    });
  }

  /**
   * Cria a Order + dispara o payment-intent no MP. Recebe o `draft` direto do
   * `onSubmit` do PaymentStep (último step) — não há mais `state.paymentDraft`
   * persistido porque o payment é o último step e não há "Revisão pós-pagamento".
   *
   * Quando o pagamento é PIX/Boleto, limpa o cart e mostra o `PaymentResult`
   * com QR/link. Quando é cartão aprovado na hora, vai direto pro sucesso (o
   * SuccessClient limpa o cart no mount).
   */
  async function confirmOrder(draft: PaymentSubmitPayload) {
    if (!state.address || !state.quote || items.length === 0) {
      dispatch({
        type: "SUBMIT_FAIL",
        message: "Faltam dados para finalizar o pedido.",
      });
      return;
    }
    dispatch({ type: "SUBMIT_START" });

    const orderPayload = {
      userId: user!.uid,
      orderNumber: makeOrderNumber(),
      status: "pending_payment" as const,
      paymentMethod: draft.paymentMethod,
      paymentStatus: "pending" as const,
      items: orderItemsFromCart(items),
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal,
      discountTotal,
      shippingTotal,
      grandTotal,
      currency: "BRL" as const,
      ...(state.appliedCoupon ? { couponCode: state.appliedCoupon.code } : {}),
      shippingAddressPath: shippingAddressPath(user!.uid, state.address.id),
      shippingMethod: {
        providerId: state.quote.providerId,
        carrier: state.quote.carrier,
        service: state.quote.service,
        serviceCode: state.quote.serviceCode,
        price: state.quote.price,
        basePrice: state.quote.basePrice,
        freeShippingApplied: state.quote.freeShippingApplied,
        estimatedDays: state.quote.estimatedDays,
      },
    };

    try {
      const orderRes = await fetchWithTimeout(
        "/api/orders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        },
        CONFIRM_TIMEOUT_MS,
      );
      if (!orderRes.ok) {
        const body = (await orderRes.json().catch(() => ({}))) as { message?: string };
        throw new ApiResponseError(
          body.message ?? "Não foi possível criar o pedido.",
          orderRes.status,
        );
      }
      const created = (await orderRes.json()) as { id: string };

      // Fire-and-forget: persiste lastName + CPF no UserProfile em paralelo
      // com a chamada ao MP, pra próxima compra trazer pré-preenchido. Se
      // falhar, persistProfileFields apenas loga (não derruba o pagamento).
      void persistProfileFields(user!.uid, draft.payer);

      const intentRes = await fetchWithTimeout(
        "/api/checkout/payment-intent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, orderId: created.id }),
        },
        CONFIRM_TIMEOUT_MS,
      );
      if (!intentRes.ok) {
        const body = (await intentRes.json().catch(() => ({}))) as { message?: string };
        throw new ApiResponseError(
          body.message ?? "Não foi possível processar o pagamento.",
          intentRes.status,
        );
      }
      const result = (await intentRes.json()) as PaymentResultData;

      // TODO: remove after card flow validated — pra diagnosticar caso o
      // cartão volte pro step de pagamento em vez de redirecionar.
      console.log("[checkout] payment-intent result:", result);

      if (result.status === "paid") {
        // TODO: remove after card flow validated
        console.log(
          `[checkout] paid → navigating to /checkout/sucesso/${created.id}`,
        );
        // `window.location.assign` em vez de `router.replace` por robustez:
        // o client router do Next pode ser interrompido por re-renders do
        // Brick após `onSubmit` resolver. Full reload garante navegação.
        // SuccessClient limpa o cart no mount da página de sucesso.
        window.location.assign(`/checkout/sucesso/${created.id}`);
        return;
      }

      // TODO: remove after card flow validated
      console.log(
        `[checkout] !paid (status=${result.status}) → dispatching SUBMIT_OK`,
      );
      // PIX/Boleto pendentes: limpa cart antes de mostrar o PaymentResult. O
      // guard de cart vazio (logo abaixo) bypassa o redirect enquanto
      // `state.paymentResult` está presente, então o user permanece vendo o
      // QR/boleto até clicar "Acompanhar pedido".
      await clearCart();
      dispatch({ type: "SUBMIT_OK", orderId: created.id, result });
    } catch (err) {
      if (err instanceof ApiResponseError) {
        dispatch({ type: "SUBMIT_FAIL", message: err.message });
      } else if (err instanceof DOMException && err.name === "AbortError") {
        dispatch({
          type: "SUBMIT_FAIL",
          message: "Tempo limite excedido. Verifique sua conexão e tente novamente.",
        });
      } else if (err instanceof TypeError) {
        dispatch({
          type: "SUBMIT_FAIL",
          message:
            "Sua conexão caiu ou está instável. Verifique a internet e tente novamente.",
        });
      } else {
        throw err;
      }
    }
  }

  return (
    <div className={styles.layout}>
      <header className={styles.stepperWrap}>
        <StepIndicator
          steps={VISIBLE_STEPS}
          currentStep={activeStep === "result" ? "review" : activeStep}
        />
      </header>

      <div className={styles.grid}>
        <main className={styles.main}>
          {activeStep === "address" && (
            <AddressStep
              userId={user!.uid}
              selectedAddressId={state.address?.id ?? null}
              defaultRecipientName={
                profile
                  ? `${profile.firstName} ${profile.lastName}`.trim()
                  : user!.name
              }
              onSelect={(a) => dispatch({ type: "SET_ADDRESS", address: a })}
              onContinue={() => goToStep("shipping")}
            />
          )}

          {activeStep === "shipping" && state.address && (
            <ShippingStep
              postalCode={state.address.postalCode}
              items={items}
              subtotal={subtotal}
              selectedQuote={state.quote}
              onSelect={(q) => dispatch({ type: "SET_QUOTE", quote: q })}
              onContinue={() => goToStep("review")}
              onBack={goBack}
            />
          )}

          {activeStep === "review" && state.address && state.quote && (
            <section className={styles.reviewSection}>
              <h2 className={styles.heading}>Revise antes de pagar</h2>
              <ReviewSummary
                address={state.address}
                quote={state.quote}
                onEditAddress={() => goToStep("address")}
                onEditShipping={() => goToStep("shipping")}
              />
              <CouponField
                cartTotal={subtotal + shippingTotal}
                applied={state.appliedCoupon}
                onApplied={(c) => dispatch({ type: "APPLY_COUPON", coupon: c })}
                onCleared={() => dispatch({ type: "CLEAR_COUPON" })}
              />
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.backBtn}
                  onClick={goBack}
                  disabled={state.submitting}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className={styles.confirmBtn}
                  onClick={() => goToStep("payment")}
                  disabled={state.submitting}
                >
                  Continuar para pagamento
                </button>
              </div>
            </section>
          )}

          {activeStep === "payment" && state.address && (
            <>
              <PaymentStep
                cartTotal={grandTotal}
                shippingAddress={{
                  postalCode: state.address.postalCode,
                  line1: state.address.line1,
                  number: state.address.number,
                  neighborhood: state.address.neighborhood,
                  city: state.address.city,
                  state: state.address.state,
                }}
                defaultEmail={profile?.email ?? user!.email}
                defaultFirstName={profile?.firstName ?? user!.name.split(/\s+/)[0]}
                defaultLastName={
                  profile?.lastName ??
                  user!.name.split(/\s+/).slice(1).join(" ")
                }
                defaultIdentificationType={
                  profile?.taxIdentity?.type === "PJ" ? "CNPJ" : "CPF"
                }
                defaultIdentificationNumber={
                  profile?.taxIdentity?.type === "PF"
                    ? profile.taxIdentity.cpf
                    : profile?.taxIdentity?.type === "PJ"
                      ? profile.taxIdentity.cnpj
                      : undefined
                }
                onBack={goBack}
                onSubmit={confirmOrder}
              />
              {state.error && (
                <p role="alert" className={styles.error}>
                  {state.error}
                </p>
              )}
            </>
          )}

          {activeStep === "result" && state.paymentResult && state.orderId && (
            <section className={styles.reviewSection}>
              <PaymentResult
                result={state.paymentResult}
                onTryAgain={() => {
                  dispatch({ type: "TRY_AGAIN" });
                  startTransition(() => {
                    router.push("/checkout?step=payment");
                  });
                }}
              />
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() =>
                  router.replace(`/checkout/sucesso/${state.orderId}`)
                }
              >
                Acompanhar pedido
              </button>
            </section>
          )}
        </main>

        <aside className={styles.aside}>
          <OrderSummary
            items={items}
            subtotal={subtotal}
            shippingTotal={shippingTotal}
            discountTotal={discountTotal}
            appliedCoupon={state.appliedCoupon}
          >
            {activeStep === "payment" && state.submitting && (
              <p className={styles.processing} aria-busy="true">
                <Spinner size={16} /> Processando pagamento…
              </p>
            )}
          </OrderSummary>
        </aside>
      </div>
    </div>
  );
}
