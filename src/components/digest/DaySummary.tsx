interface DaySummaryProps {
  summary: string | null;
}

export function DaySummary({ summary }: DaySummaryProps) {
  if (!summary) return null;

  return (
    <div className="py-5">
      <p className="text-[17px] text-text-secondary leading-relaxed font-light">
        {summary}
      </p>
    </div>
  );
}
