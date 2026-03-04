/**
 * ScoreBar Component
 *
 * Visual bar for bullish score (0-1).
 * Terminal aesthetic: sharp edges, amber fill, no rounded corners.
 */

import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface ScoreBarProps {
  /** Bullish score from 0 to 1 */
  score: number;
  /** Optional className for the container */
  className?: string;
  /** Show numeric value alongside bar */
  showValue?: boolean;
  /** Number of indicators contributing to this score */
  indicatorCount?: number;
}

/**
 * Get fill color class based on score.
 * - 0.0-0.4 -> loss (red)
 * - 0.4-0.6 -> amber (neutral)
 * - 0.6-1.0 -> profit (green)
 */
function getScoreColor(score: number): string {
  if (score < 0.4) return "bg-data-loss";
  if (score > 0.6) return "bg-data-profit";
  return "bg-terminal-amber";
}

/**
 * Get text color class for the numeric value.
 */
function getTextColor(score: number): string {
  if (score < 0.4) return "text-data-loss";
  if (score > 0.6) return "text-data-profit";
  return "text-text-tertiary";
}

function getScoreLabel(score: number): string {
  if (score < 0.4) return "bearish";
  if (score > 0.6) return "bullish";
  return "neutral";
}

export function ScoreBar({
  score,
  className,
  showValue = true,
  indicatorCount,
}: ScoreBarProps) {
  // Clamp score between 0 and 1
  const clampedScore = Math.max(0, Math.min(1, score));
  const percentage = clampedScore * 100;

  const tooltipText = indicatorCount
    ? `Bullish Score: ${clampedScore.toFixed(3)} (${getScoreLabel(clampedScore)}) — Aggregated from ${indicatorCount} indicators. Green = bullish bias, Red = bearish bias.`
    : `Bullish Score: ${clampedScore.toFixed(3)} (${getScoreLabel(clampedScore)}) — Green = bullish bias, Red = bearish bias.`;

  return (
    <InfoTooltip content={tooltipText} side="top">
      <div className={cn("flex items-center gap-2", className)}>
        {/* Track + Fill */}
        <div
          className="relative h-1.5 w-[100px] overflow-hidden rounded-none bg-void-muted"
          role="progressbar"
          aria-valuenow={Math.round(clampedScore * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Bullish score: ${clampedScore.toFixed(3)}`}
        >
          {/* Fill */}
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-none transition-colors-fast",
              getScoreColor(clampedScore)
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Numeric value */}
        {showValue && (
          <span
            className={cn(
              "font-mono text-sm font-semibold tabular-nums",
              getTextColor(clampedScore)
            )}
          >
            {clampedScore.toFixed(3)}
          </span>
        )}
      </div>
    </InfoTooltip>
  );
}
