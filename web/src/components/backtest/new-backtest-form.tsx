"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { launchBacktest } from "@/app/backtest/actions";
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

  return (
    <form
      action={handleSubmit}
      className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
    >
      <h2 className="mb-3 text-sm font-semibold text-primary">
        New Backtest
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Strategy */}
        <div>
          <label htmlFor="backtest-strategy" className="mb-1 block text-xs text-muted">Strategy</label>
          <select
            id="backtest-strategy"
            name="strategy"
            required
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-primary"
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
          <label htmlFor="backtest-timeframe" className="mb-1 block text-xs text-muted">Timeframe</label>
          <select
            id="backtest-timeframe"
            name="timeframe"
            required
            defaultValue="1h"
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-primary"
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
          <label htmlFor="backtest-symbol" className="mb-1 block text-xs text-muted">Symbol</label>
          <select
            id="backtest-symbol"
            name="symbol"
            required
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-primary"
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
          <label htmlFor="backtest-start-date" className="mb-1 block text-xs text-muted">Start Date</label>
          <input
            id="backtest-start-date"
            type="date"
            name="startDate"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-primary"
          />
        </div>

        {/* End Date */}
        <div>
          <label htmlFor="backtest-end-date" className="mb-1 block text-xs text-muted">End Date</label>
          <input
            id="backtest-end-date"
            type="date"
            name="endDate"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-primary"
          />
        </div>

        {/* Submit */}
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white transition-colors-fast hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Launching..." : "Run Backtest"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-[var(--bearish-strong)]">{error}</p>
      )}
      {success && (
        <p className="mt-2 text-xs text-[var(--bullish-strong)]">{success}</p>
      )}
    </form>
  );
}
