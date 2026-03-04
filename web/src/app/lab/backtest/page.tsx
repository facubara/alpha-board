import { PageHeader } from "@/components/terminal";
import { getBacktestRuns } from "@/lib/queries/backtest";
import { NewBacktestForm } from "@/components/backtest/new-backtest-form";
import { BacktestList } from "@/components/backtest/backtest-list";

export const dynamic = "force-dynamic";

export default async function BacktestPage() {
  const runs = await getBacktestRuns();

  return (
    <div className="space-y-6">
      <PageHeader title="Backtest" subtitle="Test strategies against historical data before deploying to live agents" />
      <NewBacktestForm />
      <BacktestList runs={runs} />
    </div>
  );
}
