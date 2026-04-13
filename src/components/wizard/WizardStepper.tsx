"use client";

const STEPS = ["Interesses", "Fontes", "Preferencias", "Revisao"];

interface WizardStepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function WizardStepper({ currentStep, onStepClick }: WizardStepperProps) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {STEPS.map((label, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        const isClickable = i < currentStep;

        return (
          <div key={i} className="flex items-center">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(i)}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm font-medium ${
                isCurrent
                  ? "bg-primary text-white"
                  : isCompleted
                    ? "bg-surface-light text-primary cursor-pointer hover:bg-surface"
                    : "bg-surface text-text-muted cursor-default"
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-black/20">
                {isCompleted ? "✓" : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-0.5 mx-1 ${isCompleted ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
