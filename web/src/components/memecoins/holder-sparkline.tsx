/**
 * HolderSparkline — Pure SVG mini line chart for token tracker data.
 * Green if trending up, red if down. Shows "—" when < 2 data points.
 */

import type { TokenSnapshot } from "@/lib/types";

interface HolderSparklineProps {
  snapshots: TokenSnapshot[];
  width?: number;
  height?: number;
}

export function HolderSparkline({
  snapshots,
  width = 80,
  height = 24,
}: HolderSparklineProps) {
  const values = snapshots
    .map((s) => s.holders)
    .filter((v): v is number => v != null);

  if (values.length < 2) {
    return <span className="text-[10px] text-muted">—</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * chartW;
    const y = padding + chartH - ((v - min) / range) * chartH;
    return `${x},${y}`;
  });

  const trending = values[values.length - 1] >= values[0];
  const color = trending ? "#22c55e" : "#ef4444";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
