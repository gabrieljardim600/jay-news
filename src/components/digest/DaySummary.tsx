import { Card } from "@/components/ui/Card";

interface DaySummaryProps {
  summary: string | null;
}

export function DaySummary({ summary }: DaySummaryProps) {
  if (!summary) return null;

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
      <h2 className="text-sm font-semibold text-text-secondary mb-2">Resumo do dia</h2>
      <p className="text-text leading-relaxed">{summary}</p>
    </Card>
  );
}
