import Link from "next/link";

/**
 * Agent not found page.
 */
export default function AgentNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4">
      <h2 className="font-mono text-2xl font-semibold text-primary">404</h2>
      <p className="text-sm text-secondary">Agent not found</p>
      <Link
        href="/agents"
        className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-primary transition-colors-fast hover:bg-[var(--bg-elevated)]"
      >
        Back to Agent Arena
      </Link>
    </div>
  );
}
