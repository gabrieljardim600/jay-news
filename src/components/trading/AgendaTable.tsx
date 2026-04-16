"use client";

import type { AgendaEvent } from "@/lib/trading/types";

const FLAG: Record<string, string> = { BR: "🇧🇷", EUA: "🇺🇸", Global: "🌐" };

export function AgendaTable({ events }: { events: AgendaEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="p-4 rounded-[14px] border border-border bg-surface">
        <h3 className="text-[13px] font-semibold mb-2">Agenda do dia</h3>
        <p className="text-[12px] text-text-muted">Nenhum evento de alto impacto detectado para hoje.</p>
      </div>
    );
  }
  return (
    <div className="p-4 rounded-[14px] border border-border bg-surface">
      <h3 className="text-[13px] font-semibold mb-3">Agenda do dia</h3>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-text-muted text-left">
              <th className="pb-2 px-1 font-medium w-16">Horário</th>
              <th className="pb-2 px-1 font-medium">Evento</th>
              <th className="pb-2 px-1 font-medium w-16 text-center">Impacto</th>
              <th className="pb-2 px-1 font-medium w-10 text-center">Região</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {events.map((ev, i) => (
              <tr key={i} className="hover:bg-background/40 transition-colors">
                <td className="py-2 px-1 text-text-muted font-mono">{ev.time}</td>
                <td className="py-2 px-1 font-medium text-text">{ev.event}</td>
                <td className="py-2 px-1 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${ev.impact === "alto" ? "bg-red-500" : "bg-yellow-500"}`} />
                </td>
                <td className="py-2 px-1 text-center">{FLAG[ev.region] ?? ev.region}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
