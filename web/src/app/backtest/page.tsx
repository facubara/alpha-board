import { getBacktestRuns } from "@/lib/queries/backtest";
import { NewBacktestForm } from "@/components/backtest/new-backtest-form";
import { BacktestList } from "@/components/backtest/backtest-list";

export const dynamic = "force-dynamic";

export default async function BacktestPage() {
  const runs = await getBacktestRuns();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-primary">Backtest</h1>
        <p className="mt-1 text-sm text-secondary">
          Test strategies against historical data before deploying to live agents
        </p>
      </div>
      <NewBacktestForm />
      <BacktestList runs={runs} />
    </div>
  );
}
