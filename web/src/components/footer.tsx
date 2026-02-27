export function Footer() {
  return (
    <footer className="mx-auto max-w-[1200px] border-t border-[var(--border-default)] px-4 py-6 sm:px-8">
      <div className="flex flex-col items-center gap-2 text-xs text-muted sm:flex-row sm:justify-between">
        <p>
          Not financial advice. All agent balances and trades are simulated.
          Past performance does not guarantee future results.
        </p>
        <div className="flex items-center gap-3">
          <span>&copy; 2026 Alpha Board</span>
          <span className="text-[var(--border-default)]">&middot;</span>
          <span>Terms</span>
          <span className="text-[var(--border-default)]">&middot;</span>
          <span>Privacy</span>
        </div>
      </div>
    </footer>
  );
}
