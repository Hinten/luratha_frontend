"use client";

import { useEffect, useReducer, useState } from "react";
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
  { id: "payment", label: "Pagamento" },
  { id: "review", label: "Revisão" },
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
  paymentDraft: PaymentSubmitPayload | null;
  appliedCoupon: AppliedCoupon | null;
  paymentResult: PaymentResultData | null;
  orderId: string | null;
  submitting: boolean;
  error: string | null;
}

type Action =
  | { type: "SET_ADDRESS"; address: Address }
  | { type: "SET_QUOTE"; quote: ShippingQuote }
  | { type: "SET_PAYMENT_DRAFT"; draft: PaymentSubmitPayload }
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
    case "SET_PAYMENT_DRAFT":
      return { ...state, paymentDraft: action.draft, error: null };
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
    paymentDraft: null,
    appliedCoupon: null,
    paymentResult: null,
    orderId: null,
    submitting: false,
    error: null,
  };
}

/**
 * Garante que o step solicitado satisfaz os pré-requisitos de estado.
 * Deep link em `?step=review` sem `paymentDraft` cai pra "address" — bloqueia
 * pular etapas via URL e mantém a navegação consistente com o reducer.
 */
function enforceStepPrereqs(
  requested: VisibleStepId,
  state: State,
): VisibleStepId {
  if (requested === "shipping" && !state.address) return "address";
  if (requested === "payment" && (!state.address || !state.quote)) {
    return "address";
  }
  if (
    requested === "review" &&
    (!state.address || !state.quote || !state.paymentDraft)
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
  // clearCart deliberadamente NÃO consumido aqui: a página de sucesso
  // (SuccessClient) já limpa o cart ao montar, e limpar aqui dispararia o
  // guard de "carrinho vazio" do CheckoutPage antes da navegação completar
  // (race que mandava o usuário pro /carrinho em vez de /checkout/sucesso).
  const { items } = useCart();
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

  function goToStep(step: VisibleStepId) {
    dispatch({ type: "CLEAR_ERROR" });
    router.push(`/checkout?step=${step}`);
  }

  function goBack() {
    dispatch({ type: "CLEAR_ERROR" });
    router.back();
  }

  async function confirmOrder() {
    if (
      !state.address ||
      !state.quote ||
      !state.paymentDraft ||
      items.length === 0
    ) {
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
      paymentMethod: state.paymentDraft.paymentMethod,
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
      void persistProfileFields(user!.uid, state.paymentDraft.payer);

      const intentRes = await fetchWithTimeout(
        "/api/checkout/payment-intent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...state.paymentDraft, orderId: created.id }),
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

      if (result.status === "paid") {
        // Cart é limpo no SuccessClient quando a página de sucesso monta —
        // limpar aqui dispararia o guard de empty-cart do CheckoutPage antes
        // do replace completar.
        router.replace(`/checkout/sucesso/${created.id}`);
        return;
      }

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
              onContinue={() => goToStep("payment")}
              onBack={goBack}
            />
          )}

          {activeStep === "payment" && state.address && (
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
              onSubmit={async (draft) => {
                dispatch({ type: "SET_PAYMENT_DRAFT", draft });
                router.push("/checkout?step=review");
              }}
            />
          )}

          {activeStep === "review" &&
            state.address &&
            state.quote &&
            state.paymentDraft && (
              <section className={styles.reviewSection}>
                <h2 className={styles.heading}>Revise antes de pagar</h2>
                <ReviewSummary
                  address={state.address}
                  quote={state.quote}
                  paymentDraft={state.paymentDraft}
                  onEditAddress={() => goToStep("address")}
                  onEditShipping={() => goToStep("shipping")}
                  onEditPayment={() => goToStep("payment")}
                />
                <CouponField
                  cartTotal={subtotal + shippingTotal}
                  applied={state.appliedCoupon}
                  onApplied={(c) => dispatch({ type: "APPLY_COUPON", coupon: c })}
                  onCleared={() => dispatch({ type: "CLEAR_COUPON" })}
                />
                {state.error && (
                  <p role="alert" className={styles.error}>
                    {state.error}
                  </p>
                )}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={goBack}
                    disabled={state.submitting}
                  >
                    Voltar
                  </button>
                </div>
              </section>
            )}

          {activeStep === "result" && state.paymentResult && state.orderId && (
            <section className={styles.reviewSection}>
              <PaymentResult
                result={state.paymentResult}
                onTryAgain={() => {
                  dispatch({ type: "TRY_AGAIN" });
                  router.push("/checkout?step=payment");
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
            {activeStep === "review" && (
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={confirmOrder}
                disabled={state.submitting}
                aria-busy={state.submitting}
              >
                {state.submitting ? (
                  <>
                    <Spinner size={16} /> Processando…
                  </>
                ) : (
                  "Confirmar pedido"
                )}
              </button>
            )}
          </OrderSummary>
        </aside>
      </div>
    </div>
  );
}
