"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { TradingDateNav } from "@/components/trading/TradingDateNav";
import { TradingPanel } from "@/components/trading/TradingPanel";
import { TradingSkeleton } from "@/components/trading/TradingSkeleton";
import { Loader2, Zap, Sun, Moon } from "lucide-react";
import type { TradingBrief, TradingEdition } from "@/lib/trading/types";

function todayBRT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export default function TradingPage() {
  const today = todayBRT();
  const [date, setDate] = useState(today);
  const [edition, setEdition] = useState<TradingEdition>("morning");
  const [brief, setBrief] = useState<TradingBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBrief(null);
    setError(null);
    (async () => {
      const res = await fetch(`/api/trading?date=${date}&limit=2`);
      if (cancelled) return;
      if (res.ok) {
        const briefs: TradingBrief[] = await res.json();
        const match = briefs.find((b) => b.edition === edition && b.status === "completed");
        setBrief(match ?? null);
        // If no match for current edition but other exists, show other
        if (!match && briefs.length > 0) {
          const other = briefs.find((b) => b.status === "completed");
          if (other) {
            setBrief(other);
            setEdition(other.edition);
          }
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [date, edition]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/trading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edition, date }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const data: TradingBrief = await res.json();
      setBrief(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar briefing");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-20">
      <AppHeader />

      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Trading broadcast
        </p>
        <p className="text-[13px] text-text-secondary mt-0.5">
          Briefing diário pré-mercado e fechamento para day traders de mini contratos.
        </p>
      </div>

      <TradingDateNav
        date={date}
        edition={edition}
        onDateChange={setDate}
        onEditionChange={setEdition}
        today={today}
      />

      {loading ? (
        <TradingSkeleton />
      ) : brief ? (
        <TradingPanel brief={brief} />
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
            {edition === "morning"
              ? <Sun className="w-7 h-7 text-amber-500" />
              : <Moon className="w-7 h-7 text-indigo-400" />}
          </div>
          <p className="text-text-secondary text-[17px] font-medium mb-1">
            {edition === "morning" ? "Morning brief" : "Closing brief"}
          </p>
          <p className="text-text-muted text-[14px] mb-6">
            {date === today
              ? `Nenhum ${edition === "morning" ? "morning" : "closing"} brief gerado para hoje.`
              : `Nenhum brief encontrado para ${new Date(date + "T12:00:00").toLocaleDateString("pt-BR")}.`}
          </p>

          {error && (
            <p className="text-[13px] text-red-500 mb-4">{error}</p>
          )}

          <Button
            onClick={generate}
            loading={generating}
            className="rounded-full px-6"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Gerando (~45s)...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-1.5" />
                Gerar {edition === "morning" ? "morning" : "closing"} brief
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
