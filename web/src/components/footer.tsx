export function Footer() {
  return (
    <footer className="mx-auto max-w-[1400px] border-t border-void-border px-4 py-6 sm:px-8">
      <div className="flex flex-col items-center gap-2 text-xs text-text-tertiary font-mono sm:flex-row sm:justify-between">
        <p>
          Not financial advice. All agent balances and trades are simulated.
          Past performance does not guarantee future results.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-terminal-amber">&gt;_ ALPHA-BOARD v3.0</span>
          <span className="text-void-border">&middot;</span>
          <span>&copy; 2026 Alpha Board</span>
          <span className="text-void-border">&middot;</span>
          <span>Terms</span>
          <span className="text-void-border">&middot;</span>
          <span>Privacy</span>
        </div>
      </div>
    </footer>
  );
}
