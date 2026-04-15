"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { ONBOARDING_STEPS, type OnboardingKey } from "./steps";

type Props = {
  startKey: OnboardingKey;
  mode: "tour" | "single";
  onClose: () => void;
};

export function OnboardingModal({ startKey, mode, onClose }: Props) {
  // When mode=tour we walk through ONBOARDING_STEPS starting from the given key
  // (normally "intro"). When mode=single we show only the step that matches the key.
  const steps = useMemo(() => {
    if (mode === "single") return ONBOARDING_STEPS.filter((s) => s.key === startKey);
    const startIdx = Math.max(0, ONBOARDING_STEPS.findIndex((s) => s.key === startKey));
    return ONBOARDING_STEPS.slice(startIdx);
  }, [mode, startKey]);

  const [idx, setIdx] = useState(0);
  const step = steps[idx];
  const isLast = idx === steps.length - 1;
  const isFirst = idx === 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && !isLast) setIdx((i) => i + 1);
      else if (e.key === "ArrowLeft" && !isFirst) setIdx((i) => i - 1);
    }
    window.addEventListener("keydown", onKey);
    // Block body scroll while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFirst, isLast, onClose]);

  if (!step) return null;
  const Icon = step.icon;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:w-full sm:max-w-[560px] max-h-[92vh] sm:max-h-[85vh] bg-background border border-border rounded-t-[22px] sm:rounded-[20px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative px-5 sm:px-7 pt-6 pb-4 border-b border-border">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text hover:bg-surface transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${step.accent}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 pr-8">
              <h2 id="onboarding-title" className="text-[17px] sm:text-[18px] font-semibold font-heading leading-tight tracking-tight">
                {step.title}
              </h2>
              <p className="text-[12.5px] sm:text-[13px] text-text-secondary mt-1 leading-snug">
                {step.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">
          <ul className="flex flex-col gap-3.5">
            {step.sections.map((sec, i) => {
              const SectionIcon = sec.icon;
              return (
                <li key={i} className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-[10px] bg-surface flex items-center justify-center shrink-0">
                    {SectionIcon ? (
                      <SectionIcon className="w-4 h-4 text-text-secondary" />
                    ) : (
                      <span className="text-[12px] font-semibold text-text-muted">{i + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[13.5px] font-semibold leading-snug">{sec.heading}</p>
                    <p className="text-[12.5px] text-text-secondary mt-0.5 leading-relaxed">{sec.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          {step.footerTip && (
            <div className="mt-5 p-3 rounded-[10px] bg-surface border border-border/60">
              <p className="text-[11.5px] text-text-muted leading-relaxed">
                <span className="font-semibold text-text-secondary">Dica:</span> {step.footerTip}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-4 border-t border-border flex items-center justify-between gap-3">
          {steps.length > 1 ? (
            <div className="flex items-center gap-1.5">
              {steps.map((s, i) => (
                <span
                  key={s.key}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? "w-6 bg-primary" : i < idx ? "w-1.5 bg-primary/50" : "w-1.5 bg-border"
                  }`}
                />
              ))}
              <span className="ml-2 text-[11px] text-text-muted">{idx + 1}/{steps.length}</span>
            </div>
          ) : <span />}
          <div className="flex items-center gap-1.5">
            {steps.length > 1 && !isFirst && (
              <button
                onClick={() => setIdx((i) => i - 1)}
                className="h-9 px-3 rounded-full text-[13px] font-medium text-text-secondary hover:text-text hover:bg-surface flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Voltar
              </button>
            )}
            {isLast ? (
              <button
                onClick={onClose}
                className="h-9 px-4 rounded-full bg-primary text-white text-[13px] font-medium hover:bg-primary-hover flex items-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Entendi
              </button>
            ) : (
              <button
                onClick={() => setIdx((i) => i + 1)}
                className="h-9 px-4 rounded-full bg-primary text-white text-[13px] font-medium hover:bg-primary-hover flex items-center gap-1 transition-colors"
              >
                Próximo <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
