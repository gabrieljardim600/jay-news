"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useGeneration } from "@/context/GenerationContext";

// Rotating sub-messages per stage category, to give a sense of activity
const STAGE_ROTATIONS: { match: string; messages: string[] }[] = [
  {
    match: "Buscando artigos",
    messages: [
      "Recuperando informacoes das fontes...",
      "Consultando fontes configuradas...",
      "Verificando ultimas publicacoes...",
      "Coletando noticias recentes...",
    ],
  },
  {
    match: "Buscando fontes",
    messages: [
      "Acessando sites e feeds RSS...",
      "Extraindo links e manchetes...",
      "Navegando pelas paginas de noticias...",
      "Coletando artigos disponiveis...",
    ],
  },
  {
    match: "conteudo completo",
    messages: [
      "Extraindo materia completa...",
      "Lendo artigos na integra...",
      "Buscando texto original das fontes...",
      "Capturando conteudo editorial...",
    ],
  },
  {
    match: "Limpando",
    messages: [
      "Removendo publicidade...",
      "Filtrando conteudo comercial...",
      "Refinando texto das materias...",
      "Removendo propaganda e banners...",
    ],
  },
  {
    match: "Processando",
    messages: [
      "Analisando relevancia das noticias...",
      "Classificando por temas...",
      "Gerando resumos com IA...",
      "Avaliando impacto das materias...",
    ],
  },
  {
    match: "Filtrando",
    messages: [
      "Aplicando filtros de exclusao...",
      "Removendo duplicatas...",
      "Selecionando os melhores artigos...",
    ],
  },
  {
    match: "resumo",
    messages: [
      "Consolidando os destaques do dia...",
      "Criando visao geral das noticias...",
      "Finalizando seu digest...",
    ],
  },
];

function getRotations(stage: string): string[] {
  const match = STAGE_ROTATIONS.find((r) => stage.toLowerCase().includes(r.match.toLowerCase()));
  return match?.messages ?? [];
}

export function GlobalProgressBar() {
  const { genState } = useGeneration();
  const [subMessage, setSubMessage] = useState("");
  const [rotIdx, setRotIdx] = useState(0);

  // Cycle sub-messages every 3.5s when generating
  useEffect(() => {
    if (genState.status !== "generating") {
      setSubMessage("");
      return;
    }

    const rotations = getRotations(genState.stage);
    if (rotations.length === 0) {
      setSubMessage("");
      return;
    }

    setRotIdx(0);
    setSubMessage(rotations[0]);

    const timer = setInterval(() => {
      setRotIdx((prev) => {
        const next = (prev + 1) % rotations.length;
        setSubMessage(rotations[next]);
        return next;
      });
    }, 3500);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genState.stage, genState.status]);

  const { status, progress, stage, sourceResults } = genState;

  if (status === "idle") return null;

  const isCompleted = status === "completed";
  const isFailed = status === "failed";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="max-w-3xl mx-auto px-4 pb-4">
        <div
          className="pointer-events-auto rounded-[14px] border shadow-xl backdrop-blur-md"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          }}
        >
          {/* Progress bar track */}
          <div className="h-1 w-full overflow-hidden rounded-t-[14px]">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: isFailed
                  ? "var(--color-danger)"
                  : isCompleted
                  ? "var(--color-success)"
                  : "var(--color-primary)",
              }}
            />
          </div>

          <div className="px-4 py-3">
            {/* Main row */}
            <div className="flex items-center gap-2.5">
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "var(--color-success)" }} />
              ) : isFailed ? (
                <XCircle className="w-4 h-4 shrink-0" style={{ color: "var(--color-danger)" }} />
              ) : (
                <Loader2
                  className="w-4 h-4 shrink-0 animate-spin"
                  style={{ color: "var(--color-primary)" }}
                />
              )}

              <span
                className="text-[13px] font-medium flex-1 truncate"
                style={{ color: "var(--color-text)" }}
              >
                {stage || "Gerando digest..."}
              </span>

              <span
                className="text-[12px] font-mono shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              >
                {Math.round(progress)}%
              </span>
            </div>

            {/* Rotating sub-message */}
            {subMessage && status === "generating" && (
              <p
                className="text-[11px] mt-1 ml-6.5 truncate"
                style={{ color: "var(--color-text-muted)" }}
              >
                {subMessage}
              </p>
            )}

            {/* Source results */}
            {sourceResults.length > 0 && status === "generating" && (
              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                {sourceResults.slice(0, 6).map((sr, i) => (
                  <div key={i} className="flex items-center gap-1 text-[11px]">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        background:
                          sr.status === "ok"
                            ? "var(--color-success)"
                            : sr.status === "error"
                            ? "var(--color-danger)"
                            : "var(--color-warning)",
                      }}
                    />
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {sr.name}
                      {sr.status === "ok" && (
                        <span style={{ color: "var(--color-text-secondary)" }}> · {sr.count}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
