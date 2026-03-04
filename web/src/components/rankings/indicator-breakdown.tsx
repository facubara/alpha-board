/**
 * IndicatorBreakdown Component
 *
 * Expandable section showing per-indicator signal breakdown.
 * Terminal aesthetic: sharp edges, no rounded corners, semantic colors for data only.
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { IndicatorSignal } from "@/lib/types";

interface IndicatorBreakdownProps {
  signals: IndicatorSignal[];
  className?: string;
}

/**
 * Tooltip descriptions for known indicators.
 */
const INDICATOR_TOOLTIPS: Record<string, string> = {
  ema: "Exponential Moving Average — compares short and long-term EMAs to gauge trend direction and momentum.",
  macd: "Moving Average Convergence Divergence — measures the relationship between two EMAs to identify momentum shifts.",
  rsi: "Relative Strength Index — oscillator (0-100) measuring speed and magnitude of price changes. >70 = overbought, <30 = oversold.",
  bollinger_bands:
    "Bollinger Bands — volatility indicator using a moving average +/- 2 standard deviations. Squeezes often precede breakouts.",
  volume: "Volume Analysis — compares current volume to recent averages to detect unusual buying or selling activity.",
  trend: "Trend Strength — evaluates the directional consistency of price movement across multiple timeframes.",
  stochastic:
    "Stochastic Oscillator — compares closing price to its range over a period. >80 = overbought, <20 = oversold.",
  adx: "Average Directional Index — measures trend strength regardless of direction. >25 = strong trend, <20 = weak/no trend.",
  obv: "On-Balance Volume — cumulative volume indicator that relates volume to price changes to confirm trends.",
  atr: "Average True Range — measures market volatility. Higher ATR = more volatile price action.",
  vwap: "Volume Weighted Average Price — the average price weighted by volume, used as a benchmark for fair value.",
  ichimoku:
    "Ichimoku Cloud — multi-component indicator showing support/resistance, trend direction, and momentum at a glance.",
};

/**
 * Get fill color class based on signal value (-1 to +1).
 */
function getSignalColor(signal: number): string {
  if (signal < -0.2) return "bg-data-loss";
  if (signal > 0.2) return "bg-data-profit";
  return "bg-terminal-amber";
}

/**
 * Get text color class based on signal value.
 */
function getSignalTextColor(signal: number): string {
  if (signal < -0.2) return "text-data-loss";
  if (signal > 0.2) return "text-data-profit";
  return "text-text-tertiary";
}

/**
 * Get badge styling based on label.
 * Terminal aesthetic: muted bg with semantic text color.
 */
function getBadgeStyles(label: "bullish" | "bearish" | "neutral"): string {
  switch (label) {
    case "bullish":
      return "bg-terminal-amber-muted text-data-profit hover:bg-terminal-amber-muted";
    case "bearish":
      return "bg-terminal-amber-muted text-data-loss hover:bg-terminal-amber-muted";
    case "neutral":
    default:
      return "bg-void-muted text-text-secondary hover:bg-void-muted";
  }
}

/**
 * Format signal value with sign.
 */
function formatSignal(signal: number): string {
  const sign = signal >= 0 ? "+" : "";
  return `${sign}${signal.toFixed(2)}`;
}

export function IndicatorBreakdown({
  signals,
  className,
}: IndicatorBreakdownProps) {
  if (!signals || signals.length === 0) {
    return (
      <div className={cn("py-3 text-sm text-text-tertiary", className)}>
        No indicator data available
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 py-3", className)}>
      {signals.map((indicator) => {
        const tooltip = INDICATOR_TOOLTIPS[indicator.name];

        return (
          <div
            key={indicator.name}
            className="grid grid-cols-[1fr] gap-2 text-sm sm:grid-cols-[120px_100px_50px_70px_1fr] sm:items-center sm:gap-4"
          >
            {/* Indicator name */}
            <div className="flex items-center justify-between sm:block">
              <span className="flex items-center truncate text-text-secondary">
                {tooltip ? (
                  <InfoTooltip content={tooltip} side="right">
                    <span className="cursor-help border-b border-dotted border-void-border">
                      {indicator.displayName}
                    </span>
                  </InfoTooltip>
                ) : (
                  indicator.displayName
                )}
              </span>
              {/* Mobile: show badge inline */}
              <Badge
                variant="secondary"
                className={cn(
                  "ml-2 text-xs uppercase sm:hidden",
                  getBadgeStyles(indicator.label)
                )}
              >
                {indicator.label}
              </Badge>
            </div>

            {/* Mini score bar (signal normalized for display) */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="relative h-1 w-16 overflow-hidden rounded-none bg-void-muted">
                {/* Center line at 50% representing 0 */}
                <div className="absolute left-1/2 top-0 h-full w-px bg-void-border" />

                {/* Fill from center based on signal direction */}
                {indicator.signal >= 0 ? (
                  <div
                    className={cn(
                      "absolute top-0 h-full",
                      getSignalColor(indicator.signal)
                    )}
                    style={{
                      left: "50%",
                      width: `${Math.abs(indicator.signal) * 50}%`,
                    }}
                  />
                ) : (
                  <div
                    className={cn(
                      "absolute top-0 h-full",
                      getSignalColor(indicator.signal)
                    )}
                    style={{
                      right: "50%",
                      width: `${Math.abs(indicator.signal) * 50}%`,
                    }}
                  />
                )}
              </div>
            </div>

            {/* Signal value */}
            <span
              className={cn(
                "hidden font-mono text-xs font-medium tabular-nums sm:block",
                getSignalTextColor(indicator.signal)
              )}
            >
              {formatSignal(indicator.signal)}
            </span>

            {/* Sentiment badge (desktop only) */}
            <Badge
              variant="secondary"
              className={cn(
                "hidden w-fit text-xs uppercase sm:inline-flex",
                getBadgeStyles(indicator.label)
              )}
            >
              {indicator.label}
            </Badge>

            {/* Description */}
            <span className="truncate text-xs text-text-tertiary">
              {indicator.description}
            </span>

            {/* Mobile: show bar and value */}
            <div className="flex items-center gap-3 sm:hidden">
              <div className="relative h-1 w-20 overflow-hidden rounded-none bg-void-muted">
                <div className="absolute left-1/2 top-0 h-full w-px bg-void-border" />
                {indicator.signal >= 0 ? (
                  <div
                    className={cn(
                      "absolute top-0 h-full",
                      getSignalColor(indicator.signal)
                    )}
                    style={{
                      left: "50%",
                      width: `${Math.abs(indicator.signal) * 50}%`,
                    }}
                  />
                ) : (
                  <div
                    className={cn(
                      "absolute top-0 h-full",
                      getSignalColor(indicator.signal)
                    )}
                    style={{
                      right: "50%",
                      width: `${Math.abs(indicator.signal) * 50}%`,
                    }}
                  />
                )}
              </div>
              <span
                className={cn(
                  "font-mono text-xs font-medium tabular-nums",
                  getSignalTextColor(indicator.signal)
                )}
              >
                {formatSignal(indicator.signal)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
