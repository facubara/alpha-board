interface PnlTextProps {
  value: number;
  className?: string;
  showSign?: boolean;
}

export function PnlText({ value, className = "", showSign = true }: PnlTextProps) {
  const color =
    value > 0
      ? "text-data-profit"
      : value < 0
        ? "text-data-loss"
        : "text-data-neutral";

  const formatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sign = showSign ? (value > 0 ? "+" : value < 0 ? "-" : "") : value < 0 ? "-" : "";

  return (
    <span className={`font-mono ${color} ${className}`}>
      {sign}${formatted}
    </span>
  );
}
