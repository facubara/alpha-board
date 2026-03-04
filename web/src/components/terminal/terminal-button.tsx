interface TerminalButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  onClick?: () => void;
  active?: boolean;
}

export function TerminalButton({
  children,
  variant = "primary",
  className = "",
  onClick,
  active = false,
}: TerminalButtonProps) {
  if (variant === "primary") {
    return (
      <button
        onClick={onClick}
        className={`bg-terminal-amber text-void hover:bg-terminal-amber-hover font-mono text-sm uppercase tracking-wider px-4 py-2 transition-colors rounded-none ${className}`}
      >
        [ {children} ]
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`bg-transparent border border-void-border font-mono text-sm px-4 py-2 transition-all rounded-none ${
        active
          ? "border-terminal-amber text-terminal-amber bg-terminal-amber-muted"
          : "text-text-primary hover:bg-void-muted hover:border-text-tertiary"
      } ${className}`}
    >
      {children}
    </button>
  );
}
