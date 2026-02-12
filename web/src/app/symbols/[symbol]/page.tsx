import { notFound } from "next/navigation";
import { ChartContainer } from "@/components/charts/chart-container";

export const dynamic = "force-dynamic";

const SYMBOL_RE = /^[A-Z0-9]{2,20}$/;

interface SymbolPageProps {
  params: Promise<{ symbol: string }>;
}

export default async function SymbolPage({ params }: SymbolPageProps) {
  const { symbol } = await params;
  const upperSymbol = symbol.toUpperCase();

  if (!SYMBOL_RE.test(upperSymbol)) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-mono text-xl font-semibold text-primary">
          {upperSymbol}
        </h1>
        <a
          href={`https://www.binance.com/en/trade/${upperSymbol.replace("USDT", "_USDT")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#F0B90B] transition-transform hover:scale-110"
          title="Trade on Binance"
        >
          <svg className="h-4 w-4" viewBox="0 0 32 32" fill="currentColor">
            <path d="M16 4l4 4-4 4-4-4zm8 8l4 4-4 4-4-4zm-16 0l4 4-4 4-4-4zm8 8l4 4-4 4-4-4z" />
          </svg>
        </a>
      </div>

      <ChartContainer symbol={upperSymbol} height={600} />

      {/* Indicator legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-[#3B82F6]" />
          EMA 20
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-[#F59E0B]" />
          EMA 50
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-[#8B5CF6]" />
          EMA 200
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded"
            style={{
              backgroundImage: "repeating-linear-gradient(to right, #6B6B6B 0, #6B6B6B 3px, transparent 3px, transparent 6px)",
            }}
          />
          Bollinger Bands
        </span>
      </div>
    </div>
  );
}
