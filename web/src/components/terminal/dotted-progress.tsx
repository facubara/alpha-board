interface DottedProgressProps {
  progress: number;
  totalDots?: number;
  activeColor?: string;
}

export function DottedProgress({
  progress,
  totalDots = 20,
  activeColor = "bg-terminal-amber",
}: DottedProgressProps) {
  const activeCount = Math.round((progress / 100) * totalDots);

  return (
    <div className="flex items-center gap-[2px]">
      <span className="font-mono text-xs text-text-secondary mr-2">[</span>
      {Array.from({ length: totalDots }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
            i < activeCount ? activeColor : "bg-void-border opacity-50"
          }`}
        />
      ))}
      <span className="font-mono text-xs text-text-secondary ml-2">]</span>
    </div>
  );
}
