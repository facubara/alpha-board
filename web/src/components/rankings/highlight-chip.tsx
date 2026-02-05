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
import type { Highlight, HighlightSentiment } from "@/lib/types";

interface HighlightChipProps {
  highlight: Highlight;
  className?: string;
}

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

export function HighlightChip({ highlight, className }: HighlightChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-1 text-xs font-medium",
        getSentimentStyles(highlight.sentiment),
        className
      )}
    >
      {highlight.text}
    </span>
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
