"use client";

export default function AgentDetailError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-4">
      <div className="border border-void-border bg-void-surface p-8 max-w-lg w-full">
        <div className="font-mono text-xs uppercase tracking-widest text-data-loss mb-4">
          [ERROR] AGENT_DETAIL_FAULT
        </div>
        <p className="font-mono text-sm text-text-secondary mb-2">
          Failed to load agent data.
        </p>
        <pre className="font-mono text-xs text-text-tertiary mb-6 break-all whitespace-pre-wrap">
          {error.message || "Unknown error"}
        </pre>
        <button
          onClick={reset}
          className="font-mono text-xs uppercase tracking-widest border border-terminal-amber text-terminal-amber px-4 py-2 hover:bg-terminal-amber/10 transition-colors"
        >
          [RETRY]
        </button>
      </div>
    </div>
  );
}
