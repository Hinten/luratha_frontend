"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import type { Address, CartItem } from "@luratha/schemas";
import { useAuth } from "@/src/contexts/AuthContext";
import { useCart } from "@/src/contexts/CartContext";
import { ApiResponseError } from "@/src/lib/errors";
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
import styles from "./CheckoutFlow.module.css";

type StepId = "address" | "shipping" | "payment" | "review" | "result";

const VISIBLE_STEPS: CheckoutStep[] = [
  { id: "address", label: "Endereço" },
  { id: "shipping", label: "Frete" },
  { id: "payment", label: "Pagamento" },
  { id: "review", label: "Revisão" },
];

interface State {
  step: StepId;
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
  | { type: "GO_TO"; step: StepId }
  | { type: "SET_ADDRESS"; address: Address }
  | { type: "SET_QUOTE"; quote: ShippingQuote }
  | { type: "SET_PAYMENT_DRAFT"; draft: PaymentSubmitPayload }
  | { type: "APPLY_COUPON"; coupon: AppliedCoupon }
  | { type: "CLEAR_COUPON" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_OK"; orderId: string; result: PaymentResultData }
  | { type: "SUBMIT_FAIL"; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "GO_TO":
      return { ...state, step: action.step, error: null };
    case "SET_ADDRESS":
      return { ...state, address: action.address };
    case "SET_QUOTE":
      return { ...state, quote: action.quote };
    case "SET_PAYMENT_DRAFT":
      return { ...state, paymentDraft: action.draft, step: "review", error: null };
    case "APPLY_COUPON":
      return { ...state, appliedCoupon: action.coupon };
    case "CLEAR_COUPON":
      return { ...state, appliedCoupon: null };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };
    case "SUBMIT_OK":
      return {
        ...state,
        submitting: false,
        orderId: action.orderId,
        paymentResult: action.result,
        step: "result",
      };
    case "SUBMIT_FAIL":
      return { ...state, submitting: false, error: action.message };
  }
}

function emptyInitial(): State {
  return {
    step: "address",
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

export default function CheckoutFlow() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, clearCart } = useCart();
  const [state, dispatch] = useReducer(reducer, undefined, emptyInitial);

  if (!user) return null;

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const discountTotal = state.appliedCoupon?.discount ?? 0;
  const shippingTotal = state.quote?.price ?? 0;
  const grandTotal = Math.max(0, subtotal - discountTotal + shippingTotal);

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
        basePrice: state.quote.price,
        freeShippingApplied: false,
        estimatedDays: state.quote.estimatedDays,
      },
    };

    try {
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      if (!orderRes.ok) {
        const body = (await orderRes.json().catch(() => ({}))) as { message?: string };
        throw new ApiResponseError(
          body.message ?? "Não foi possível criar o pedido.",
          orderRes.status,
        );
      }
      const created = (await orderRes.json()) as { id: string };

      const intentRes = await fetch("/api/checkout/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state.paymentDraft, orderId: created.id }),
      });
      if (!intentRes.ok) {
        const body = (await intentRes.json().catch(() => ({}))) as { message?: string };
        throw new ApiResponseError(
          body.message ?? "Não foi possível processar o pagamento.",
          intentRes.status,
        );
      }
      const result = (await intentRes.json()) as PaymentResultData;

      if (result.status === "paid") {
        await clearCart();
        router.replace(`/checkout/sucesso/${created.id}`);
        return;
      }

      dispatch({ type: "SUBMIT_OK", orderId: created.id, result });
    } catch (err) {
      if (err instanceof ApiResponseError) {
        dispatch({ type: "SUBMIT_FAIL", message: err.message });
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
          currentStep={state.step === "result" ? "review" : state.step}
        />
      </header>

      <div className={styles.grid}>
        <main className={styles.main}>
          {state.step === "address" && (
            <AddressStep
              userId={user!.uid}
              selectedAddressId={state.address?.id ?? null}
              onSelect={(a) => dispatch({ type: "SET_ADDRESS", address: a })}
              onContinue={() => dispatch({ type: "GO_TO", step: "shipping" })}
            />
          )}

          {state.step === "shipping" && state.address && (
            <ShippingStep
              postalCode={state.address.postalCode}
              items={items}
              selectedQuote={state.quote}
              onSelect={(q) => dispatch({ type: "SET_QUOTE", quote: q })}
              onContinue={() => dispatch({ type: "GO_TO", step: "payment" })}
              onBack={() => dispatch({ type: "GO_TO", step: "address" })}
            />
          )}

          {state.step === "payment" && state.address && (
            <PaymentStep
              cartTotal={grandTotal}
              defaultRecipientName={state.address.recipientName}
              shippingAddress={{
                postalCode: state.address.postalCode,
                line1: state.address.line1,
                number: state.address.number,
                neighborhood: state.address.neighborhood,
                city: state.address.city,
                state: state.address.state,
              }}
              onBack={() => dispatch({ type: "GO_TO", step: "shipping" })}
              onSubmit={async (draft) => {
                dispatch({ type: "SET_PAYMENT_DRAFT", draft });
              }}
            />
          )}

          {state.step === "review" && (
            <section className={styles.reviewSection}>
              <h2 className={styles.heading}>Revise antes de pagar</h2>
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
                  onClick={() => dispatch({ type: "GO_TO", step: "payment" })}
                  disabled={state.submitting}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className={styles.confirmBtn}
                  onClick={confirmOrder}
                  disabled={state.submitting}
                >
                  {state.submitting ? "Processando…" : "Confirmar pedido"}
                </button>
              </div>
            </section>
          )}

          {state.step === "result" && state.paymentResult && state.orderId && (
            <section className={styles.reviewSection}>
              <PaymentResult
                result={state.paymentResult}
                onTryAgain={() => dispatch({ type: "GO_TO", step: "payment" })}
              />
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={async () => {
                  await clearCart();
                  router.replace(`/checkout/sucesso/${state.orderId}`);
                }}
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
          />
        </aside>
      </div>
    </div>
  );
}
