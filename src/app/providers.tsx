"use client";

import { GenerationProvider } from "@/context/GenerationContext";
import { DataCacheProvider } from "@/context/DataCacheContext";
import { OnboardingProvider } from "@/context/OnboardingContext";
import { AskJayProvider } from "@/context/AskJayContext";
import { GlobalProgressBar } from "@/components/ui/GlobalProgressBar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DataCacheProvider>
      <GenerationProvider>
        <OnboardingProvider>
          <AskJayProvider>
            <GlobalProgressBar />
            {children}
          </AskJayProvider>
        </OnboardingProvider>
      </GenerationProvider>
    </DataCacheProvider>
  );
}
