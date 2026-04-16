"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { WatchlistList } from "@/components/jay-brain/WatchlistList";
import { useAskJay } from "@/context/AskJayContext";
import type { WatchlistItem } from "@/types";

export default function WatchlistPage() {
  const router = useRouter();
  const askJay = useAskJay();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/watchlist");
    if (res.ok) {
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-10 pb-28">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors text-text-secondary"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight leading-tight">Watchlist</h1>
            <p className="text-[12px] text-text-muted leading-tight">Itens que o Jay acompanha para você</p>
          </div>
        </div>
        <button
          onClick={() => askJay.open({ type: "watchlist" })}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-surface hover:bg-surface-light text-text-secondary hover:text-text text-[13px] font-medium transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Ask Jay
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <WatchlistList items={items} onRefresh={load} />
      )}
    </div>
  );
}
