"use client";

import { GenerationProvider } from "@/context/GenerationContext";
import { DataCacheProvider } from "@/context/DataCacheContext";
import { GlobalProgressBar } from "@/components/ui/GlobalProgressBar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DataCacheProvider>
      <GenerationProvider>
        <GlobalProgressBar />
        {children}
      </GenerationProvider>
    </DataCacheProvider>
  );
}
