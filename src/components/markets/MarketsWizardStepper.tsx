"use client";

import { Check } from "lucide-react";

const STEPS = ["Mercado", "Sub-tópicos", "Concorrentes", "Fontes"];

interface Props {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function MarketsWizardStepper({ currentStep, onStepClick }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((label, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <div key={i} className="flex items-center">
            <button
              type="button"
              onClick={() => isCompleted && onStepClick(i)}
              disabled={!isCompleted}
              className="flex items-center gap-2"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold transition-all duration-300 ${
                  isCurrent
                    ? "bg-primary text-white shadow-sm shadow-primary/30"
                    : isCompleted
                      ? "bg-success text-white cursor-pointer"
                      : "bg-surface text-text-muted"
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={`text-[13px] font-medium hidden sm:inline transition-colors ${
                  isCurrent
                    ? "text-text"
                    : isCompleted
                      ? "text-text-secondary cursor-pointer hover:text-text"
                      : "text-text-muted"
                }`}
              >
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-10 h-[1.5px] mx-3 transition-colors duration-300 ${isCompleted ? "bg-success" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
