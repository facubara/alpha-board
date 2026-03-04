import { useMemo } from "react";

function generateDotPattern(seed: string, gridSize: number): boolean[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const half = Math.ceil(gridSize / 2);
  const pattern: boolean[] = new Array(gridSize * gridSize).fill(false);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < half; x++) {
      const idx = y * half + x;
      const isActive = ((hash >> (idx % 16)) & 1) === 1;
      // Mirror horizontally for symmetry
      pattern[y * gridSize + x] = isActive;
      pattern[y * gridSize + (gridSize - 1 - x)] = isActive;
    }
  }

  return pattern;
}

interface DottedAvatarProps {
  agentId: string;
  gridSize?: 4 | 6 | 8;
  status?: "idle" | "processing" | "executing" | "error";
  className?: string;
}

const NODE_SIZE: Record<number, string> = {
  4: "w-1.5 h-1.5",
  6: "w-1.5 h-1.5",
  8: "w-1 h-1",
};

export function DottedAvatar({
  agentId,
  gridSize = 6,
  status = "idle",
  className = "",
}: DottedAvatarProps) {
  const pattern = useMemo(() => generateDotPattern(agentId, gridSize), [agentId, gridSize]);

  const activeColor =
    status === "executing"
      ? "bg-data-profit"
      : status === "error"
        ? "bg-data-loss"
        : "bg-terminal-amber";

  const animate = status === "processing" ? "animate-pulse" : "";

  return (
    <div
      className={`inline-flex p-1 border border-void-border bg-void-surface rounded-none ${className}`}
    >
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {pattern.map((isActive, i) => (
          <div
            key={i}
            className={`${NODE_SIZE[gridSize]} rounded-full transition-colors duration-300 ${
              isActive ? `${activeColor} ${animate}` : "bg-void-border opacity-50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
