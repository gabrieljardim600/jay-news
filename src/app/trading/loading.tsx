import { TradingSkeleton } from "@/components/trading/TradingSkeleton";

export default function TradingLoading() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-5 py-8 pb-20">
      <TradingSkeleton />
    </div>
  );
}
