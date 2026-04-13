interface DaySummaryProps {
  summary: string | null;
}

export function DaySummary({ summary }: DaySummaryProps) {
  if (!summary) return null;

  return (
    <div className="py-6 border-b border-border">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
        Resumo do dia
      </p>
      <p className="text-text leading-relaxed text-[15px]">{summary}</p>
    </div>
  );
}
