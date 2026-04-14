"use client";

import { GenerationProvider } from "@/context/GenerationContext";
import { GlobalProgressBar } from "@/components/ui/GlobalProgressBar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GenerationProvider>
      <GlobalProgressBar />
      {children}
    </GenerationProvider>
  );
}
