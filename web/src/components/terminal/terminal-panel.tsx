interface TerminalPanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function TerminalPanel({ children, className = "", title }: TerminalPanelProps) {
  return (
    <div className={`bg-void-surface border border-void-border rounded-none p-4 ${className}`}>
      {title && (
        <div className="mb-3 border-b border-void-border pb-2">
          <span className="text-xs uppercase tracking-widest text-text-tertiary font-sans">
            {title}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
