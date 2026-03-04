"use client";

interface DottedLoaderProps {
  color?: string;
  text?: string;
}

export function DottedLoader({
  color = "bg-terminal-amber",
  text,
}: DottedLoaderProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex items-center gap-[2px]">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full animate-pulse ${color}`}
            style={{ animationDelay: `${i * 150}ms`, animationDuration: "1s" }}
          />
        ))}
      </span>
      {text && (
        <span className="font-mono text-xs text-text-secondary ml-1">{text}</span>
      )}
    </span>
  );
}
