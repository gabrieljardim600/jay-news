"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import type { SourceResult } from "@/types";

export interface GenerationState {
  digestId: string | null;
  configId: string | null;
  status: "idle" | "generating" | "completed" | "failed";
  progress: number;
  stage: string;
  sourceResults: SourceResult[];
}

interface GenerationContextValue {
  genState: GenerationState;
  startGeneration: (configId: string) => Promise<string | null>;
}

const defaultState: GenerationState = {
  digestId: null,
  configId: null,
  status: "idle",
  progress: 0,
  stage: "",
  sourceResults: [],
};

const STORAGE_KEY = "jnews-gen-v1";

const GenerationCtx = createContext<GenerationContextValue>({
  genState: defaultState,
  startGeneration: async () => null,
});

export function useGeneration() {
  return useContext(GenerationCtx);
}

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const [genState, setGenState] = useState<GenerationState>(defaultState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function patch(updates: Partial<GenerationState>) {
    setGenState((prev) => {
      const next = { ...prev, ...updates };
      try {
        if (next.status === "idle") {
          localStorage.removeItem(STORAGE_KEY);
        } else if (next.digestId) {
          // Only persist once we have a real digestId — needed for restoration on refresh
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ digestId: next.digestId, configId: next.configId, status: next.status })
          );
        }
      } catch {}
      return next;
    });
  }

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startPolling(digestId: string) {
    stopPolling();
    let attempts = 0;

    intervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 90) {
        stopPolling();
        patch({ status: "failed", stage: "Timeout — tente novamente", progress: 0 });
        setTimeout(() => patch(defaultState), 3500);
        return;
      }

      try {
        const res = await fetch(`/api/digest/${digestId}`);
        const data = await res.json();

        const up: Partial<GenerationState> = {};
        if (data.metadata?.progress !== undefined) up.progress = data.metadata.progress;
        if (data.metadata?.stage) up.stage = data.metadata.stage;
        if (data.metadata?.source_results) up.sourceResults = data.metadata.source_results;

        if (data.status === "completed") {
          stopPolling();
          patch({ ...up, status: "completed", progress: 100, stage: "Concluido!" });
          setTimeout(() => patch(defaultState), 3000);
        } else if (data.status === "failed") {
          stopPolling();
          const errMsg = data.metadata?.error || "Falha na geracao";
          patch({ ...up, status: "failed", stage: `Erro: ${errMsg.slice(0, 80)}` });
          setTimeout(() => patch(defaultState), 5000);
        } else if (Object.keys(up).length > 0) {
          patch(up);
        }
      } catch {
        // Network error — keep polling
      }
    }, 2000);
  }

  // On mount: restore in-progress generation from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { digestId, configId, status } = JSON.parse(stored);
        if (status === "generating" && digestId) {
          patch({ digestId, configId, status: "generating", progress: 10, stage: "Retomando...", sourceResults: [] });
          startPolling(digestId);
        }
      }
    } catch {}
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGeneration = useCallback(async (configId: string): Promise<string | null> => {
    stopPolling();
    patch({
      digestId: null,
      configId,
      status: "generating",
      progress: 5,
      stage: "Iniciando...",
      sourceResults: [],
    });

    try {
      const res = await fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestConfigId: configId }),
      });

      if (!res.ok) {
        patch({ status: "failed", stage: "Erro ao iniciar geracao" });
        setTimeout(() => patch(defaultState), 3000);
        return null;
      }

      const { digestId } = await res.json();
      patch({ digestId, progress: 10, stage: "Buscando artigos..." });
      startPolling(digestId);
      return digestId;
    } catch {
      patch({ status: "failed", stage: "Erro de conexao" });
      setTimeout(() => patch(defaultState), 3000);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GenerationCtx.Provider value={{ genState, startGeneration }}>
      {children}
    </GenerationCtx.Provider>
  );
}
