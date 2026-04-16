"use client";

import { ChevronLeft, ChevronRight, Sun, Moon } from "lucide-react";
import type { TradingEdition } from "@/lib/trading/types";

function formatDate(d: string): string {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

function isWeekday(d: string): boolean {
  const dt = new Date(d + "T12:00:00");
  const day = dt.getDay();
  return day > 0 && day < 6;
}

function addDays(d: string, n: number): string {
  const dt = new Date(d + "T12:00:00");
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

function prevWeekday(d: string): string {
  let curr = addDays(d, -1);
  while (!isWeekday(curr)) curr = addDays(curr, -1);
  return curr;
}

function nextWeekday(d: string): string {
  let curr = addDays(d, 1);
  while (!isWeekday(curr)) curr = addDays(curr, 1);
  return curr;
}

export function TradingDateNav({
  date, edition, onDateChange, onEditionChange, today,
}: {
  date: string;
  edition: TradingEdition;
  onDateChange: (d: string) => void;
  onEditionChange: (e: TradingEdition) => void;
  today: string;
}) {
  const isToday = date === today;
  const canNext = date < today;
  return (
    <div className="flex items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onDateChange(prevWeekday(date))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface text-text-muted hover:text-text transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDateChange(today)}
          className={`px-3 h-8 rounded-full text-[13px] font-medium transition-colors ${
            isToday ? "bg-text text-background" : "bg-surface border border-border text-text hover:bg-surface-light"
          }`}
        >
          {isToday ? "Hoje" : formatDate(date)}
        </button>
        <button
          onClick={() => canNext && onDateChange(nextWeekday(date))}
          disabled={!canNext}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface text-text-muted hover:text-text transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-full bg-surface border border-border">
        <button
          onClick={() => onEditionChange("morning")}
          className={`flex items-center gap-1 h-7 px-3 rounded-full text-[12px] font-medium transition-all ${
            edition === "morning" ? "bg-text text-background" : "text-text-muted hover:text-text"
          }`}
        >
          <Sun className="w-3 h-3" /> Morning
        </button>
        <button
          onClick={() => onEditionChange("closing")}
          className={`flex items-center gap-1 h-7 px-3 rounded-full text-[12px] font-medium transition-all ${
            edition === "closing" ? "bg-text text-background" : "text-text-muted hover:text-text"
          }`}
        >
          <Moon className="w-3 h-3" /> Closing
        </button>
      </div>
    </div>
  );
}
