/**
 * HighlightChip Component
 *
 * Small badges showing key signals.
 * Per DESIGN_SYSTEM.md:
 * - Bullish: bg bullish-subtle, text bullish-strong
 * - Bearish: bg bearish-subtle, text bearish-strong
 * - Neutral: bg bg-muted, text text-secondary
 * - Padding: 4px 8px
 * - Font: text-xs, weight 500
 * - Border radius: 4px
 */

import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { Highlight, HighlightSentiment } from "@/lib/types";

/**
 * Tooltip descriptions for known highlight patterns.
 */
const HIGHLIGHT_TOOLTIPS: Record<string, string> = {
  "Strong Uptrend":
    "Price is in a strong upward trend across multiple moving averages.",
  "Strong Downtrend":
    "Price is in a strong downward trend across multiple moving averages.",
  "EMA Bullish":
    "Short-term EMA is above long-term EMA, signaling upward momentum.",
  "EMA Bearish":
    "Short-term EMA is below long-term EMA, signaling downward momentum.",
  "MACD Bullish":
    "MACD line crossed above signal line, indicating potential upward momentum.",
  "MACD Bearish":
    "MACD line crossed below signal line, indicating potential downward momentum.",
  "Strong Buying":
    "Volume significantly exceeds recent average, suggesting strong buyer interest.",
  "Strong Selling":
    "Volume significantly exceeds recent average on the sell side.",
  "BB Squeeze":
    "Bollinger Bands are narrowing, often preceding a large price move.",
  "Above BB Upper":
    "Price is above the upper Bollinger Band — overbought or strong momentum.",
  "Below BB Lower":
    "Price is below the lower Bollinger Band — oversold or strong selling pressure.",
  "No Trend":
    "No clear directional trend detected; price is moving sideways.",
  "Overbought":
    "RSI or similar oscillator indicates the asset may be overbought.",
  "Oversold":
    "RSI or similar oscillator indicates the asset may be oversold.",
};

/**
 * Get styling classes based on sentiment.
 */
function getSentimentStyles(sentiment: HighlightSentiment): string {
  switch (sentiment) {
    case "bullish":
      return "bg-[var(--bullish-subtle)] text-[var(--bullish-strong)]";
    case "bearish":
      return "bg-[var(--bearish-subtle)] text-[var(--bearish-strong)]";
    case "neutral":
    default:
      return "bg-[var(--bg-muted)] text-[var(--text-secondary)]";
  }
}

export function HighlightChip({ highlight, className }: { highlight: Highlight; className?: string }) {
  const tooltip = HIGHLIGHT_TOOLTIPS[highlight.text];

  const chip = (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-1 text-xs font-medium",
        tooltip && "cursor-help",
        getSentimentStyles(highlight.sentiment),
        className
      )}
    >
      {highlight.text}
    </span>
  );

  if (!tooltip) return chip;

  return (
    <InfoTooltip content={tooltip} side="top">
      {chip}
    </InfoTooltip>
  );
}

interface HighlightChipsProps {
  highlights: Highlight[];
  /** Maximum chips to show (default: 4 per DESIGN_SYSTEM.md) */
  max?: number;
  className?: string;
}

/**
 * Renders a row of highlight chips.
 * Limited to max 4 per DESIGN_SYSTEM.md.
 */
export function HighlightChips({
  highlights,
  max = 4,
  className,
}: HighlightChipsProps) {
  const visibleChips = highlights.slice(0, max);

  if (visibleChips.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visibleChips.map((highlight, index) => (
        <HighlightChip key={`${highlight.indicator}-${index}`} highlight={highlight} />
      ))}
    </div>
  );
}
