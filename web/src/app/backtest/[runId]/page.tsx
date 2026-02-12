import Link from "next/link";
import { notFound } from "next/navigation";
import { getBacktestRun } from "@/lib/queries/backtest";
import { BacktestDetail } from "@/components/backtest/backtest-detail";

export const dynamic = "force-dynamic";

interface BacktestDetailPageProps {
  params: Promise<{ runId: string }>;
}

export default async function BacktestDetailPage({
  params,
}: BacktestDetailPageProps) {
  const { runId } = await params;
  const id = parseInt(runId, 10);

  if (isNaN(id)) {
    notFound();
  }

  const result = await getBacktestRun(id);

  if (!result) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <Link
        href="/backtest"
        className="inline-flex items-center gap-1 text-sm text-muted transition-colors-fast hover:text-primary"
      >
        &larr; All Backtests
      </Link>
      <BacktestDetail run={result.run} trades={result.trades} />
    </div>
  );
}
