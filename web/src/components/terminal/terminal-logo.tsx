import Link from "next/link";

export function TerminalLogo() {
  return (
    <Link href="/" className="flex items-center gap-0.5 select-none">
      <span className="text-terminal-amber font-mono font-semibold animate-pulse">&gt;_</span>
      <span className="font-sans font-semibold tracking-tighter text-text-primary ml-1">
        ALPHA
      </span>
      <span className="font-sans font-light text-text-secondary">BOARD</span>
    </Link>
  );
}
