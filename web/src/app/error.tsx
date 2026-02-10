"use client";

/**
 * Root error boundary.
 * Shows a minimal error state matching the e-ink aesthetic.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4">
      <h2 className="text-lg font-semibold text-primary">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-secondary">
        {error.message || "An unexpected error occurred while loading the page."}
      </p>
      <button
        onClick={reset}
        className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-primary transition-colors-fast hover:bg-[var(--bg-elevated)]"
      >
        Try again
      </button>
    </div>
  );
}
