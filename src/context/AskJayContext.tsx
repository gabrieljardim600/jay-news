"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AskJayPanel } from "@/components/jay-brain/AskJayPanel";
import type { AskJayScope } from "@/types";

interface AskJayContextValue {
  open: (scope: AskJayScope) => void;
  close: () => void;
}

const Ctx = createContext<AskJayContextValue | null>(null);

export function useAskJay() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAskJay must be used within <AskJayProvider>");
  return v;
}

export function AskJayProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<AskJayScope>({ type: "freeform" });

  const open = useCallback((next: AskJayScope) => {
    setScope(next);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      <AskJayPanel open={isOpen} scope={scope} onClose={close} />
    </Ctx.Provider>
  );
}
