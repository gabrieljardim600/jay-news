"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { LS_KEY_SEEN, keyForPath, type OnboardingKey } from "@/components/onboarding/steps";

type OnboardingContextValue = {
  open: (startKey?: OnboardingKey, mode?: "tour" | "single") => void;
  close: () => void;
};

const Ctx = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOnboarding must be used within <OnboardingProvider>");
  return v;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const [isOpen, setIsOpen] = useState(false);
  const [startKey, setStartKey] = useState<OnboardingKey>("intro");
  const [mode, setMode] = useState<"tour" | "single">("tour");

  const open = useCallback((k?: OnboardingKey, m: "tour" | "single" = "single") => {
    setStartKey(k ?? keyForPath(pathname));
    setMode(m);
    setIsOpen(true);
  }, [pathname]);

  const close = useCallback(() => {
    setIsOpen(false);
    try { localStorage.setItem(LS_KEY_SEEN, "1"); } catch {}
  }, []);

  // First-time auto-open once per browser. Skip on /login and /manage (not logged
  // routes don't need it; settings is configuration, not primary flow).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname.startsWith("/login")) return;
    try {
      const seen = localStorage.getItem(LS_KEY_SEEN);
      if (!seen) {
        setStartKey("intro");
        setMode("tour");
        setIsOpen(true);
      }
    } catch {}
  }, [pathname]);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      {isOpen && <OnboardingModal startKey={startKey} mode={mode} onClose={close} />}
    </Ctx.Provider>
  );
}
