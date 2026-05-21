import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardFormError, mountCardForm } from "../cardForm";
import type {
  CardFormCallbacks,
  CardFormConfig,
  CardFormController,
  MercadoPagoInstance,
} from "../loadSdk";

interface FakeCardFormHandle extends CardFormController {
  fireSubmit(event?: Event): void;
  fireError(error: unknown): void;
  fireMounted(error?: unknown): void;
  capturedConfig: CardFormConfig;
}

function createFakeMpInstance(initial: {
  token?: string;
  paymentMethodId?: string;
  installments?: string;
  cardholderEmail?: string;
}): { mp: MercadoPagoInstance; handle: () => FakeCardFormHandle } {
  let handle: FakeCardFormHandle | null = null;
  const mp: MercadoPagoInstance = {
    cardForm(config) {
      const callbacks: CardFormCallbacks = config.callbacks;
      const controller: FakeCardFormHandle = {
        capturedConfig: config,
        getCardFormData: () => ({
          token: initial.token ?? "tok_visa_123",
          paymentMethodId: initial.paymentMethodId ?? "visa",
          installments: initial.installments ?? "3",
          cardholderEmail: initial.cardholderEmail ?? "buyer@example.com",
        }),
        unmount: vi.fn(),
        fireSubmit: (event = new Event("submit", { cancelable: true })) => {
          callbacks.onSubmit?.(event);
        },
        fireError: (error: unknown) => {
          callbacks.onError?.(error);
        },
        fireMounted: (error?: unknown) => {
          callbacks.onFormMounted?.(error);
        },
      };
      handle = controller;
      return controller;
    },
  };
  return { mp, handle: () => handle as FakeCardFormHandle };
}

function setupFormInDom(id: string): HTMLFormElement {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const form = document.createElement("form");
  form.id = id;
  document.body.appendChild(form);
  return form;
}

const ids = {
  formId: "card-form",
  cardNumber: "cn",
  expirationDate: "exp",
  securityCode: "cvv",
  cardholderName: "name",
  installments: "inst",
  identificationType: "doc-type",
  identificationNumber: "doc-number",
  cardholderEmail: "email",
};

describe("mountCardForm", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats amount with 2 decimals and passes ids through to cardForm config", async () => {
    const { mp, handle } = createFakeMpInstance({});
    const formEl = setupFormInDom(ids.formId);
    formEl.requestSubmit = vi.fn();

    await mountCardForm({ amount: 199.5, ids }, mp);

    expect(handle().capturedConfig.amount).toBe("199.50");
    expect(handle().capturedConfig.iframe).toBe(true);
    expect(handle().capturedConfig.form.id).toBe("card-form");
    expect(handle().capturedConfig.form.cardNumber.id).toBe("cn");
    expect(handle().capturedConfig.form.cardholderEmail.id).toBe("email");
  });

  it("resolves submit() with token, paymentMethodId and installments coerced to number", async () => {
    const { mp, handle } = createFakeMpInstance({
      token: "tok_master_abc",
      paymentMethodId: "master",
      installments: "5",
      cardholderEmail: "compradora@luratha.com",
    });
    const form = setupFormInDom(ids.formId);
    form.requestSubmit = () => handle().fireSubmit();

    const cardForm = await mountCardForm({ amount: 100, ids }, mp);
    const result = await cardForm.submit();

    expect(result).toEqual({
      token: "tok_master_abc",
      paymentMethodId: "master",
      installments: 5,
      cardholderEmail: "compradora@luratha.com",
    });
  });

  it("rejects submit() with CardFormError when token is missing", async () => {
    const { mp, handle } = createFakeMpInstance({ token: "" });
    const form = setupFormInDom(ids.formId);
    form.requestSubmit = () => handle().fireSubmit();

    const cardForm = await mountCardForm({ amount: 50, ids }, mp);

    await expect(cardForm.submit()).rejects.toBeInstanceOf(CardFormError);
  });

  it("rejects submit() with CardFormError when form is not in DOM", async () => {
    const { mp } = createFakeMpInstance({});

    const cardForm = await mountCardForm({ amount: 50, ids }, mp);

    await expect(cardForm.submit()).rejects.toBeInstanceOf(CardFormError);
  });

  it("forwards onError from MP and rejects pending submit", async () => {
    const { mp, handle } = createFakeMpInstance({});
    const form = setupFormInDom(ids.formId);
    const onError = vi.fn();
    let asyncReject: () => void = () => {};
    form.requestSubmit = () => {
      asyncReject = () => handle().fireError(new Error("BIN inválida"));
    };

    const cardForm = await mountCardForm({ amount: 10, ids, onError }, mp);
    const pending = cardForm.submit();
    asyncReject();

    await expect(pending).rejects.toThrow("BIN inválida");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("unmount() calls the underlying controller.unmount()", async () => {
    const { mp, handle } = createFakeMpInstance({});
    setupFormInDom(ids.formId);

    const cardForm = await mountCardForm({ amount: 1, ids }, mp);
    cardForm.unmount();

    expect(handle().unmount).toHaveBeenCalled();
  });
});
