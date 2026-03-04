interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  prefix?: string;
}

export function StatCard({ label, value, change, prefix }: StatCardProps) {
  const changeColor =
    change === undefined
      ? ""
      : change > 0
        ? "text-data-profit"
        : change < 0
          ? "text-data-loss"
          : "text-data-neutral";

  return (
    <div className="bg-void-surface border border-void-border rounded-none p-4">
      <span className="text-xs uppercase tracking-widest text-text-tertiary font-sans">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-2">
        {prefix && (
          <span className="text-xs text-text-tertiary font-mono">{prefix}</span>
        )}
        <span className="text-xl font-mono font-medium text-text-primary">{value}</span>
        {change !== undefined && (
          <span className={`text-sm font-mono ${changeColor}`}>
            {change > 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  );
}
