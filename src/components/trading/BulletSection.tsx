"use client";

import type { LucideIcon } from "lucide-react";

export function BulletSection({
  title, icon: Icon, accent, bullets,
}: {
  title: string;
  icon: LucideIcon;
  accent: string;
  bullets: string[];
}) {
  if (bullets.length === 0) return null;
  return (
    <div className="p-4 rounded-[14px] border border-border bg-surface">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-[8px] flex items-center justify-center ${accent}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-[13px] font-semibold">{title}</h3>
        <span className="text-[10px] text-text-muted ml-auto">{bullets.length}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-snug">
            <span className="text-primary font-semibold shrink-0 mt-0.5">·</span>
            <span className="text-text">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
