"use client";

import styles from "./StepIndicator.module.css";

export interface CheckoutStep {
  id: string;
  label: string;
}

export interface StepIndicatorProps {
  steps: CheckoutStep[];
  currentStep: string;
  /** Quando fornecido, steps já visitados viram botões clicáveis (voltar). */
  onStepClick?: (stepId: string) => void;
}

type StepState = "completed" | "current" | "upcoming";

function resolveState(index: number, currentIndex: number): StepState {
  if (index < currentIndex) return "completed";
  if (index === currentIndex) return "current";
  return "upcoming";
}

export default function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  const currentIndex = Math.max(
    steps.findIndex((s) => s.id === currentStep),
    0,
  );

  return (
    <nav aria-label="Etapas do checkout" className={styles.nav}>
      <ol className={styles.list}>
        {steps.map((step, index) => {
          const state = resolveState(index, currentIndex);
          const clickable = onStepClick && state === "completed";
          const number = index + 1;
          const isCurrent = state === "current";
          return (
            <li
              key={step.id}
              className={styles.item}
              data-state={state}
              aria-current={isCurrent ? "step" : undefined}
            >
              {clickable ? (
                <button
                  type="button"
                  className={styles.bubble}
                  onClick={() => onStepClick(step.id)}
                  aria-label={`Voltar para etapa ${number}: ${step.label}`}
                >
                  {number}
                </button>
              ) : (
                <span className={styles.bubble} aria-hidden="true">
                  {number}
                </span>
              )}
              <span className={styles.labelText}>{step.label}</span>
              {index < steps.length - 1 && <span className={styles.connector} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      <p className={styles.srOnly}>
        Etapa {currentIndex + 1} de {steps.length}: {steps[currentIndex]?.label}
      </p>
    </nav>
  );
}
