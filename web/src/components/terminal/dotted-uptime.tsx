type StatusType = "up" | "down" | "degraded" | "empty";

interface DottedUptimeProps {
  history: StatusType[];
  maxDots?: number;
}

const COLOR_MAP: Record<StatusType, string> = {
  up: "bg-data-profit",
  down: "bg-data-loss animate-pulse",
  degraded: "bg-terminal-amber",
  empty: "bg-void-border opacity-40",
};

export function DottedUptime({ history, maxDots = 24 }: DottedUptimeProps) {
  const display = history.slice(-maxDots);
  const padded: StatusType[] = [
    ...Array<StatusType>(Math.max(0, maxDots - display.length)).fill("empty"),
    ...display,
  ];

  return (
    <div className="flex items-center gap-[2px]">
      {padded.map((status, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${COLOR_MAP[status]}`}
        />
      ))}
    </div>
  );
}
