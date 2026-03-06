"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { launchBacktest } from "@/app/lab/backtest/actions";
import { useAuth } from "@/components/auth/auth-provider";
import { STRATEGY_ARCHETYPES, STRATEGY_ARCHETYPE_LABELS, TIMEFRAMES } from "@/lib/types";

const POPULAR_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
];

export function NewBacktestForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const { requireAuth } = useAuth();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    requireAuth(() => {
      startTransition(async () => {
        const result = await launchBacktest(formData);

        if (result.error) {
          setError(result.error);
        } else {
          setSuccess(`Backtest #${result.runId} launched`);
          router.refresh();
        }
      });
    });
  }

  // Default dates: last 30 days
  // Initialize on mount only (useEffect) to avoid hydration mismatch from new Date()
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const now = new Date();
    const ago = new Date(now);
    ago.setDate(ago.getDate() - 30);
    setStartDate(ago.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  }, []);

  const selectClass = "w-full appearance-none bg-transparent border-b border-void-border text-text-primary font-mono text-sm focus:outline-none focus:border-terminal-amber pb-1 cursor-pointer";
  const dateClass = "w-full appearance-none bg-transparent border-b border-void-border text-text-primary font-mono text-sm focus:outline-none focus:border-terminal-amber pb-1 [color-scheme:dark]";

  return (
    <form
      action={handleSubmit}
      className="rounded-none border border-void-border bg-void-surface p-4"
    >
      <h2 className="mb-3 font-mono text-xs font-medium text-text-tertiary uppercase tracking-widest">
        New Backtest
      </h2>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Strategy */}
        <div>
          <label htmlFor="backtest-strategy" className="mb-1.5 block font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Strategy</label>
          <select
            id="backtest-strategy"
            name="strategy"
            required
            className={selectClass}
          >
            {STRATEGY_ARCHETYPES.map((s) => (
              <option key={s} value={s}>
                {STRATEGY_ARCHETYPE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe */}
        <div>
          <label htmlFor="backtest-timeframe" className="mb-1.5 block font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Timeframe</label>
          <select
            id="backtest-timeframe"
            name="timeframe"
            required
            defaultValue="1h"
            className={selectClass}
          >
            {TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        </div>

        {/* Symbol */}
        <div>
          <label htmlFor="backtest-symbol" className="mb-1.5 block font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Symbol</label>
          <select
            id="backtest-symbol"
            name="symbol"
            required
            className={selectClass}
          >
            {POPULAR_SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label htmlFor="backtest-start-date" className="mb-1.5 block font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Start Date</label>
          <input
            id="backtest-start-date"
            type="date"
            name="startDate"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={dateClass}
          />
        </div>

        {/* End Date */}
        <div>
          <label htmlFor="backtest-end-date" className="mb-1.5 block font-mono text-[10px] text-text-tertiary uppercase tracking-wider">End Date</label>
          <input
            id="backtest-end-date"
            type="date"
            name="endDate"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={dateClass}
          />
        </div>

        {/* Submit */}
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="font-mono text-sm uppercase tracking-widest border border-terminal-amber text-terminal-amber hover:bg-terminal-amber hover:text-void transition-colors px-6 py-1.5 mt-auto disabled:opacity-50"
          >
            {isPending ? "[ RUNNING... ]" : "[ INITIALIZE ]"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 font-mono text-xs text-data-loss">{error}</p>
      )}
      {success && (
        <p className="mt-2 font-mono text-xs text-data-profit">{success}</p>
      )}
    </form>
  );
}
