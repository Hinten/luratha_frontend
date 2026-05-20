import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import StepIndicator, {
  type CheckoutStep,
} from "@/src/components/checkout/StepIndicator";

const STEPS: CheckoutStep[] = [
  { id: "address", label: "Endereço" },
  { id: "shipping", label: "Frete" },
  { id: "payment", label: "Pagamento" },
  { id: "review", label: "Revisão" },
];

describe("StepIndicator", () => {
  it("renders all step labels and numbers", () => {
    render(<StepIndicator steps={STEPS} currentStep="address" />);
    STEPS.forEach((s, i) => {
      expect(screen.getByText(s.label)).toBeInTheDocument();
      expect(screen.getByText(String(i + 1))).toBeInTheDocument();
    });
  });

  it("marks the current step with aria-current=step", () => {
    render(<StepIndicator steps={STEPS} currentStep="shipping" />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });

  it("renders completed steps as buttons when onStepClick is provided", () => {
    const onStepClick = vi.fn();
    render(
      <StepIndicator
        steps={STEPS}
        currentStep="payment"
        onStepClick={onStepClick}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByRole("button")).toBeInTheDocument();
    expect(within(items[1]).getByRole("button")).toBeInTheDocument();
    // current step is NOT a button
    expect(within(items[2]).queryByRole("button")).toBeNull();
    // upcoming step is NOT a button
    expect(within(items[3]).queryByRole("button")).toBeNull();
  });

  it("does not render any buttons when onStepClick is omitted", () => {
    render(<StepIndicator steps={STEPS} currentStep="payment" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("calls onStepClick when a completed step is clicked", () => {
    const onStepClick = vi.fn();
    render(
      <StepIndicator
        steps={STEPS}
        currentStep="review"
        onStepClick={onStepClick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Voltar para etapa 2/ }));
    expect(onStepClick).toHaveBeenCalledWith("shipping");
  });

  it("falls back to the first step when currentStep is unknown", () => {
    render(<StepIndicator steps={STEPS} currentStep="nope" />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("aria-current", "step");
  });
});
